export const onRequestPost: PagesFunction<{
  BACKEND_API_URL: string;
}> = async (context) => {
  try {
    const { email, subject, message, category, paymentOrderUlid } = await context.request.json() as {
      email?: string;
      subject?: string;
      message?: string;
      category?: string;
      paymentOrderUlid?: string;
    };

    if (!email?.trim() || !subject?.trim() || !message?.trim() || !category?.trim()) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 });
    }

    const backendBaseUrl = context.env.BACKEND_API_URL;
    if (!backendBaseUrl) {
      return new Response(JSON.stringify({ error: 'Backend API URL is missing' }), { status: 500 });
    }

    // Map frontend display categories to backend enum categories:
    // Backend expected: PAYMENT_DISPUTE, TOKEN_MISSING, TECHNICAL_BUG, ACCOUNT_ISSUE, SPAM_REPORT, OTHER
    let backendCategory = 'OTHER';
    const lowerCategory = category.toLowerCase();
    
    if (lowerCategory.includes('content')) {
      backendCategory = 'SPAM_REPORT';
    } else if (lowerCategory.includes('app') || lowerCategory.includes('bug')) {
      backendCategory = 'TECHNICAL_BUG';
    } else if (lowerCategory.includes('legal') || lowerCategory.includes('compliance') || lowerCategory.includes('account')) {
      backendCategory = 'ACCOUNT_ISSUE';
    } else if (lowerCategory.includes('payment') || lowerCategory.includes('dispute')) {
      backendCategory = 'PAYMENT_DISPUTE';
    } else if (lowerCategory.includes('token')) {
      backendCategory = 'TOKEN_MISSING';
    } else {
      backendCategory = 'OTHER';
    }

    const backendUrl = `${backendBaseUrl.replace(/\/$/, '')}/api/v1/support/ticket`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // Forward Authorization token if the client passed it
    const authHeader = context.request.headers.get('Authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const backendResponse = await fetch(backendUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        subject,
        description: message, // map "message" to "description" as expected by backend
        category: backendCategory,
        paymentOrderUlid: paymentOrderUlid || "",
      }),
    });

    const responseText = await backendResponse.text();
    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = responseText;
    }

    if (!backendResponse.ok) {
      const errorMsg = data?.error || data?.message || responseText || 'Failed to submit ticket';
      return new Response(JSON.stringify({ error: errorMsg }), { 
        status: backendResponse.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      message: 'Your ticket has been submitted successfully!',
      ticket: data
    }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Submission failed' }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
};
