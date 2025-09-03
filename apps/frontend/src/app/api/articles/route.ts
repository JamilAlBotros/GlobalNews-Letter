import { NextRequest, NextResponse } from 'next/server';

// Mock data based on the database structure we saw
const mockArticles = [
  {
    id: '489a6cf9-7b6d-4714-a940-adcf97b7eb84',
    title: 'Tiny flier could soar through the mesosphere powered only by light',
    url: 'https://www.nature.com/articles/d41586-025-02676-7',
    description: 'Scientists have designed a lightweight aircraft that could potentially fly in the mesosphere using only light pressure for propulsion.',
    feed_name: 'Nature.com',
    detected_language: 'english',
    published_at: '2025-09-03T00:00:00.000Z',
    created_at: '2025-09-03T14:06:02.468Z'
  },
  {
    id: '3b727d58-0250-4bd6-9391-fe9b71d57e26',
    title: 'Inside a mosquito factory',
    url: 'https://www.nature.com/articles/d41586-025-02806-1',
    description: 'A look inside facilities that breed mosquitoes for research and disease control programs around the world.',
    feed_name: 'Nature.com',
    detected_language: 'english',
    published_at: '2025-09-03T00:00:00.000Z',
    created_at: '2025-09-03T14:06:02.467Z'
  },
  {
    id: 'f117f79b-adbe-4a37-b460-bf2fc7a2c765',
    title: 'Ultra-processed foods — it\'s time for an improved definition',
    url: 'https://www.nature.com/articles/d41586-025-02750-0',
    description: 'Researchers call for better classification systems to understand the health impacts of ultra-processed foods.',
    feed_name: 'Nature.com',
    detected_language: 'english',
    published_at: '2025-09-03T00:00:00.000Z',
    created_at: '2025-09-03T14:06:02.465Z'
  },
  {
    id: '8a9b7c6d-5e4f-3a2b-1c9d-8e7f6a5b4c3d',
    title: 'Climate change accelerates Arctic ice melt',
    url: 'https://www.nature.com/articles/d41586-025-02751-1',
    description: 'New data shows Arctic sea ice is melting at unprecedented rates due to rising global temperatures.',
    feed_name: 'Nature.com',
    detected_language: 'english',
    published_at: '2025-09-02T00:00:00.000Z',
    created_at: '2025-09-03T14:06:02.463Z'
  },
  {
    id: '1f2e3d4c-5b6a-7890-cdef-123456789abc',
    title: 'Breakthrough in quantum computing achieved',
    url: 'https://www.nature.com/articles/d41586-025-02752-2',
    description: 'Scientists have developed a new quantum processor that maintains coherence for significantly longer periods.',
    feed_name: 'Nature.com',
    detected_language: 'english',
    published_at: '2025-09-01T00:00:00.000Z',
    created_at: '2025-09-03T14:06:02.461Z'
  }
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const feed_id = searchParams.get('feed_id');
  
  // Try to fetch from backend first
  try {
    const backendUrl = new URL('/articles', process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333');
    searchParams.forEach((value, key) => {
      backendUrl.searchParams.append(key, value);
    });

    const response = await fetch(backendUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data);
    }
  } catch (error) {
    console.log('Backend unavailable, using mock data');
  }

  // Fallback to mock data
  let filteredArticles = [...mockArticles];
  
  if (feed_id) {
    filteredArticles = filteredArticles.filter(article => article.feed_name === feed_id);
  }
  
  const total = filteredArticles.length;
  const total_pages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedArticles = filteredArticles.slice(startIndex, endIndex);

  return NextResponse.json({
    data: paginatedArticles,
    pagination: {
      page,
      limit,
      total,
      total_pages
    }
  });
}