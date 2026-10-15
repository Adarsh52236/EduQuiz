require('dotenv').config();

const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.GROK_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

const VALID_CATEGORIES = [
  'Algorithms',
  'Data Structures',
  'Dynamic Programming',
  'Databases & SQL',
  'Operating Systems',
  'Computer Networks',
  'Mathematics & Logic',
  'Web & Software Engineering',
  'General CS'
];

/**
 * Categorize a question using Groq Cloud AI
 */
async function categorizeQuestion(questionText, questionType = 'multiple-choice', options = []) {
  if (!GROQ_API_KEY) {
    console.warn('[AI Categorizer] No GROQ_API_KEY found, using heuristic fallback');
    return heuristicCategorize(questionText);
  }

  try {
    const prompt = `You are a computer science curriculum and LeetCode problem categorizer.
Analyze this quiz question and classify it into standard LeetCode / Computer Science categories:

Question: "${questionText}"
Question Type: "${questionType}"
Options: ${JSON.stringify(options || [])}

Allowed categories (pick EXACTLY ONE that best fits):
${JSON.stringify(VALID_CATEGORIES)}

Respond STRICTLY with valid JSON only, using this exact format:
{
  "category": "One category from the allowed list",
  "tags": ["tag1", "tag2", "tag3"],
  "difficulty": "Easy" | "Medium" | "Hard"
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
          { role: 'system', content: 'You are an expert computer science problem categorizer. Return valid JSON only with keys: "category", "tags", "difficulty".' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 250
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[AI Categorizer] Groq API returned status ${response.status}:`, errText);
      return heuristicCategorize(questionText);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || '{}';
    
    // Clean code fences if present
    const cleanJson = rawContent.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    // Validate category
    let category = parsed.category || 'General CS';
    if (!VALID_CATEGORIES.includes(category)) {
      const match = VALID_CATEGORIES.find(c => c.toLowerCase() === category.toLowerCase());
      category = match || 'Algorithms';
    }

    const tags = Array.isArray(parsed.tags) && parsed.tags.length > 0 
      ? parsed.tags.slice(0, 4) 
      : ['Concept', 'CS'];

    let difficulty = (parsed.difficulty || 'Medium').toLowerCase();
    difficulty = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
    if (!['Easy', 'Medium', 'Hard'].includes(difficulty)) {
      difficulty = 'Medium';
    }

    return {
      category,
      tags,
      difficulty
    };

  } catch (error) {
    console.error('[AI Categorizer] Error during Groq classification:', error.message);
    return heuristicCategorize(questionText);
  }
}

/**
 * Fallback keyword heuristics if Groq API is unavailable
 */
function heuristicCategorize(text) {
  const lower = (text || '').toLowerCase();
  
  if (lower.includes('dp') || lower.includes('memoization') || lower.includes('knapsack') || lower.includes('subsequence')) {
    return { category: 'Dynamic Programming', tags: ['DP', 'Optimization'], difficulty: 'Hard' };
  }
  if (lower.includes('tree') || lower.includes('graph') || lower.includes('stack') || lower.includes('queue') || lower.includes('linked list') || lower.includes('heap') || lower.includes('hash')) {
    return { category: 'Data Structures', tags: ['Data Structures', 'Pointers'], difficulty: 'Medium' };
  }
  if (lower.includes('sort') || lower.includes('search') || lower.includes('complexity') || lower.includes('big-o') || lower.includes('recursion') || lower.includes('algorithm')) {
    return { category: 'Algorithms', tags: ['Algorithms', 'Complexity'], difficulty: 'Medium' };
  }
  if (lower.includes('sql') || lower.includes('query') || lower.includes('database') || lower.includes('table') || lower.includes('foreign key')) {
    return { category: 'Databases & SQL', tags: ['SQL', 'Database'], difficulty: 'Easy' };
  }
  if (lower.includes('thread') || lower.includes('process') || lower.includes('deadlock') || lower.includes('memory') || lower.includes('cpu')) {
    return { category: 'Operating Systems', tags: ['OS', 'Concurrency'], difficulty: 'Medium' };
  }
  if (lower.includes('tcp') || lower.includes('ip') || lower.includes('http') || lower.includes('network') || lower.includes('dns')) {
    return { category: 'Computer Networks', tags: ['Networks', 'Protocols'], difficulty: 'Easy' };
  }
  
  return { category: 'Algorithms', tags: ['General', 'Logic'], difficulty: 'Easy' };
}

module.exports = {
  categorizeQuestion,
  VALID_CATEGORIES
};
