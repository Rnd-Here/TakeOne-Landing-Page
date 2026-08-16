export const onRequestPost: PagesFunction<{ 
  ZEPTOMAIL_API_KEY: string; 
  ZEPTOMAIL_API_URL?: string;
  BACKEND_API_URL: string;
}> = async (context) => {
  try {
    const { name, email, message } = await context.request.json() as {
      name?: string; email?: string; message?: string;
    };

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), { status: 400 });
    }

    const zeptoApiUrl = context.env.ZEPTOMAIL_API_URL || 'https://api.zeptomail.com/v1.1/email';
    const zeptoApiKey = context.env.ZEPTOMAIL_API_KEY;
    const backendBaseUrl = context.env.BACKEND_API_URL;

    if (!zeptoApiKey) {
      return new Response(JSON.stringify({ error: 'ZeptoMail API Key is missing' }), { status: 500 });
    }
    if (!backendBaseUrl) {
      return new Response(JSON.stringify({ error: 'Backend API URL is missing' }), { status: 500 });
    }

    const zeptoHeaders = {
      'Authorization': `Zoho-enczapikey ${zeptoApiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // 1. Notification email to support@take1app.com
    const supportMailBody = {
      from: {
        address: 'noreply@take1app.com',
        name: 'TakeOne Landing Page Query Form',
      },
      to: [
        {
          email_address: {
            address: 'support@take1app.com',
            name: 'TakeOne Support',
          },
        },
      ],
      reply_to: [
        {
          address: email,
          name: name,
        },
      ],
      subject: `New enquiry from ${name}`,
      textbody: `You received a new enquiry:\n\nName: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
    };

    // 2. Auto-reply confirmation to the user
    const userMailBody = {
      from: {
        address: 'support@take1app.com',
        name: 'TakeOne Support',
      },
      to: [
        {
          email_address: {
            address: email,
            name: name,
          },
        },
      ],
      reply_to: [
        {
          address: 'support@take1app.com',
          name: 'TakeOne Support',
        },
      ],
      subject: 'We have received your enquiry!',
      textbody: `Hi ${name},\n\nThank you for reaching out to TakeOne. We have received your query and our team will get back to you shortly.\n\nHere is a copy of your message:\n"${message}"\n\nBest regards,\nThe TakeOne Team`,
    };

    // 3. Backend support query payload
    const backendUrl = `${backendBaseUrl.replace(/\/$/, '')}/api/v1/support/query`;
    const backendBody = {
      name,
      email,
      subject: 'Landing Page Contact Query',
      message,
    };

    // Send backend save request and both emails in parallel to minimize response latency
    const [backendResponse, supportResponse, userResponse] = await Promise.all([
      fetch(backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backendBody),
      }),
      fetch(zeptoApiUrl, {
        method: 'POST',
        headers: zeptoHeaders,
        body: JSON.stringify(supportMailBody),
      }),
      fetch(zeptoApiUrl, {
        method: 'POST',
        headers: zeptoHeaders,
        body: JSON.stringify(userMailBody),
      }),
    ]);

    // Check for failures
    if (!backendResponse.ok || !supportResponse.ok || !userResponse.ok) {
      const backendErr = !backendResponse.ok ? await backendResponse.text() : null;
      const supportErr = !supportResponse.ok ? await supportResponse.text() : null;
      const userErr = !userResponse.ok ? await userResponse.text() : null;
      
      console.error('Contact Submission Failures:', { backendErr, supportErr, userErr });

      // We still return a 500 error if any of the operations failed
      return new Response(JSON.stringify({ 
        error: 'Failed to process contact query completely.',
        details: { backendErr, supportErr, userErr }
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ ok: true }), { 
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
