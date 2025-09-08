import { NextRequest, NextResponse } from 'next/server';

const BASE_API = process.env.BASE_API || 'http://localhost:3333';

// GET /api/newsletter/drafts - Get all drafts
export async function GET(request: NextRequest) {
  try {
    console.log('Proxying newsletter drafts request to:', `${BASE_API}/newsletter/drafts`);
    
    const response = await fetch(`${BASE_API}/newsletter/drafts`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Backend newsletter drafts response not ok:', response.status, response.statusText);
      const errorText = await response.text();
      return NextResponse.json(
        { error: 'Failed to fetch newsletter drafts', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Newsletter drafts API error:', error);
    return NextResponse.json(
      { error: 'Newsletter drafts service unavailable' },
      { status: 503 }
    );
  }
}

// POST /api/newsletter/drafts - Create new draft
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('Proxying create newsletter draft request to:', `${BASE_API}/newsletter/drafts`);
    
    const response = await fetch(`${BASE_API}/newsletter/drafts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error('Backend create newsletter draft response not ok:', response.status, response.statusText);
      const errorText = await response.text();
      return NextResponse.json(
        { error: 'Failed to create newsletter draft', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Create newsletter draft API error:', error);
    return NextResponse.json(
      { error: 'Newsletter draft service unavailable' },
      { status: 503 }
    );
  }
}

// PUT /api/newsletter/drafts - Update existing draft
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('Proxying update newsletter draft request to:', `${BASE_API}/newsletter/drafts`);
    
    const response = await fetch(`${BASE_API}/newsletter/drafts`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error('Backend update newsletter draft response not ok:', response.status, response.statusText);
      const errorText = await response.text();
      return NextResponse.json(
        { error: 'Failed to update newsletter draft', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Update newsletter draft API error:', error);
    return NextResponse.json(
      { error: 'Newsletter draft service unavailable' },
      { status: 503 }
    );
  }
}