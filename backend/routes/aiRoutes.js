const express = require('express');
const router = express.Router();
const { authenticateToken } = require('./authRoutes');
const db = require('../db');

// POST /api/evaluate-answer
// Evaluates a short-answer response using Google Gemini (or a mock fallback if no API key is provided)
router.post('/evaluate-answer', authenticateToken, async (req, res) => {
  try {
    const { questionId, studentAnswer } = req.body;
    const userId = req.user.id;

    if (!questionId || !studentAnswer) {
      return res.status(400).json({ message: 'Question ID and student answer are required' });
    }

    // Fetch the question to get the correct answer (rubric) and difficulty
    const [questions] = await db.pool.query(
      'SELECT questionText, correctAnswer, difficulty, points FROM quiz_questions WHERE id = ?',
      [questionId]
    );

    if (questions.length === 0) {
      return res.status(404).json({ message: 'Question not found' });
    }

    const question = questions[0];
    
    // Check for Gemini API Key
    const geminiApiKey = process.env.GEMINI_API_KEY;
    let score = 0;
    let aiFeedback = '';
    let isCorrect = false;

    if (geminiApiKey) {
      // IDEAL SCENARIO: Use Gemini API to evaluate the answer
      // Using a simple fetch to the Gemini REST API to avoid needing extra npm packages immediately
      const prompt = `
        You are an expert AI Teacher/Recruiter grading a student's answer.
        Question: "${question.questionText}"
        Teacher's expected rubric/answer: "${question.correctAnswer}"
        Student's answer: "${studentAnswer}"
        
        Evaluate the student's answer based on the teacher's rubric. 
        Respond in strict JSON format with exactly three fields:
        {
          "score": (a number from 0 to 100 representing accuracy),
          "isPass": (boolean, true if score >= 70),
          "feedback": (A brief, encouraging 2-sentence explanation of what they got right and what they missed. Frame it as coaching.)
        }
      `;

      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        });

        const data = await response.json();
        const rawText = data.candidates[0].content.parts[0].text;
        const aiResult = JSON.parse(rawText);

        score = aiResult.score;
        isCorrect = aiResult.isPass;
        aiFeedback = aiResult.feedback;
      } catch (aiError) {
        console.error('Gemini API Error, falling back to mock:', aiError);
        // Fallback below if API fails
      }
    } 

    if (!geminiApiKey || score === 0) {
      // FALLBACK SCENARIO: Mock AI Grading (Useful for local dev without an API key)
      console.log('🤖 MOCK AI GRADING: No GEMINI_API_KEY found, using exact-match fallback.');
      
      const exactMatch = question.correctAnswer.toLowerCase().trim() === studentAnswer.toLowerCase().trim();
      const partialMatch = studentAnswer.toLowerCase().includes(question.correctAnswer.toLowerCase().substring(0, 3));
      
      if (exactMatch) {
        score = 100;
        isCorrect = true;
        aiFeedback = "Perfect! Your answer exactly matches the expected rubric.";
      } else if (partialMatch) {
        score = 50;
        isCorrect = false;
        aiFeedback = "You're on the right track, but missed some key details. Review the core concepts and try again.";
      } else {
        score = 0;
        isCorrect = false;
        aiFeedback = "Your answer doesn't quite hit the key points we were looking for. Let's study this topic a bit more!";
      }
    }

    // Calculate XP gain if it was a practice question
    let xpGain = 0;
    if (isCorrect) {
      xpGain = question.points;
      if (question.difficulty === 'hard') xpGain += 50;
      if (question.difficulty === 'medium') xpGain += 20;

      // Update the user's global XP
      await db.pool.query(
        'UPDATE users SET globalXp = globalXp + ? WHERE id = ?',
        [xpGain, userId]
      );
    }

    res.status(200).json({
      score,
      isCorrect,
      xpGained: xpGain,
      aiFeedback,
      expectedAnswer: isCorrect ? null : question.correctAnswer 
    });

  } catch (error) {
    console.error('Error evaluating answer:', error);
    res.status(500).json({ message: 'Error evaluating answer' });
  }
});

module.exports = router;
