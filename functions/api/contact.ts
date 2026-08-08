import { WorkerMailer } from 'worker-mailer';

export const onRequestPost: PagesFunction<{ 
  ZOHO_EMAIL: string; 
  ZOHO_APP_PASSWORD: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
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

    // Read SMTP settings from environment variables or fallback to defaults
    const smtpHost = context.env.SMTP_HOST || 'smtp.zoho.com'; // Defaulting to global US zoho (smtp.zoho.com)
    const smtpPort = parseInt(context.env.SMTP_PORT || '465', 10);
    const isSecure = smtpPort === 465;

    const mailer = await WorkerMailer.connect({
      credentials: {
        username: context.env.ZOHO_EMAIL,
        password: context.env.ZOHO_APP_PASSWORD,
      },
      authType: 'plain',
      host: smtpHost,
      port: smtpPort,
      secure: isSecure,
    });

    await mailer.send({
      from: context.env.ZOHO_EMAIL,
      to: context.env.ZOHO_EMAIL, // Lands in your own inbox
      replyTo: email,
      subject: `New enquiry from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
    });

    return new Response(JSON.stringify({ ok: true }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Send failed' }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
};
