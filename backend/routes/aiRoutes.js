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

// ============================================
// POST /api/ai/generate-quiz
// Generates a complete educational quiz using Groq LLM
// ============================================
router.post('/generate-quiz', authenticateToken, async (req, res) => {
  try {
    const { topic, numQuestions = 5, difficulty = 'Medium', classId } = req.body;
    const userId = req.user.id;

    if (!topic || !topic.trim()) {
      return res.status(400).json({ message: 'Topic/Subject is required for quiz generation' });
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.GROK_API_KEY;
    const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

    if (!GROQ_API_KEY) {
      return res.status(500).json({ message: 'Groq API Key not configured on server' });
    }

    const questionCount = Math.min(Math.max(parseInt(numQuestions, 10) || 5, 2), 10);

    const prompt = `You are a distinguished university professor and assessment designer.
Generate a high-quality educational quiz on the topic: "${topic.trim()}".
Difficulty: ${difficulty}.
Target Questions Count: ${questionCount}.

Return STRICTLY valid JSON ONLY without any markdown fencing, preamble, or commentary.
The JSON must follow this exact schema:
{
  "title": "Concise, professional title for the quiz",
  "description": "Engaging 2-sentence description of the quiz content and objectives",
  "category": "One of: Algorithms, Data Structures, Dynamic Programming, Databases & SQL, Operating Systems, Computer Networks, Mathematics & Logic, Web & Software Engineering, General CS",
  "timeLimit": 20,
  "questions": [
    {
      "questionText": "Clear, precise question prompt",
      "questionType": "multiple-choice",
      "points": 10,
      "difficulty": "easy" | "medium" | "hard",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Exact string matching one of the options",
      "explanation": "Brief explanation of why this answer is correct",
      "tags": ["topic-tag1", "topic-tag2"]
    }
  ]
}`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: 'You are an AI assessment generator. Return raw, parseable JSON only conforming strictly to the requested schema.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 2500
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Groq AI Quiz Error]:', errText);
      return res.status(502).json({ message: 'Groq AI service error', details: errText });
    }

    const data = await response.json();
    const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text || data.choices?.[0]?.message?.content || '{}';

    // Clean JSON content
    const cleaned = rawContent
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    let quizData;
    try {
      quizData = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('Failed to parse Groq response:', cleaned);
      return res.status(500).json({ message: 'Failed to parse AI generated quiz', raw: cleaned });
    }

    res.status(200).json({
      success: true,
      quiz: quizData
    });

  } catch (error) {
    console.error('Error in /generate-quiz:', error);
    res.status(500).json({ message: 'Error generating quiz with AI', error: error.message });
  }
});

module.exports = router;
