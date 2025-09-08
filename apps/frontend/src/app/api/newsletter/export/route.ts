import { NextRequest, NextResponse } from 'next/server';

const BASE_API = process.env.BASE_API || 'http://localhost:3333';

// POST /api/newsletter/export - Export newsletter as HTML
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('Proxying newsletter export request to:', `${BASE_API}/newsletter/export`);
    
    const response = await fetch(`${BASE_API}/newsletter/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error('Backend newsletter export response not ok:', response.status, response.statusText);
      const errorText = await response.text();
      return NextResponse.json(
        { error: 'Failed to export newsletter', details: errorText },
        { status: response.status }
      );
    }

    // Get the HTML content and pass through the headers for download
    const htmlContent = await response.text();
    const contentDisposition = response.headers.get('Content-Disposition');
    
    const headers = new Headers();
    headers.set('Content-Type', 'text/html; charset=utf-8');
    if (contentDisposition) {
      headers.set('Content-Disposition', contentDisposition);
    }
    
    return new NextResponse(htmlContent, { headers });
  } catch (error) {
    console.error('Newsletter export API error:', error);
    return NextResponse.json(
      { error: 'Newsletter export service unavailable' },
      { status: 503 }
    );
  }
}