import { NextResponse } from 'next/server';
import twilio from 'twilio';

export async function POST(req: Request) {
  try {
    const { students, status, customMessage } = await req.json();

    if (!students || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !twilioPhone) {
      console.warn('Twilio credentials not configured. Skipping SMS.');
      // Return success anyway for the demo/preview if Twilio isn't set up
      return NextResponse.json({ success: true, message: 'SMS skipped (credentials missing)' });
    }

    const client = twilio(accountSid, authToken);

    const statusMessages: Record<string, string> = {
      'picked_up': 'has been picked up from home.',
      'reached_school': 'has safely reached the school.',
      'left_school': 'has left the school for the return journey.',
      'reached_home': 'has safely reached home.',
      'emergency': 'EMERGENCY ALERT.'
    };

    const messageSuffix = statusMessages[status] || 'status has been updated.';

    const results = [];
    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      let phone = student.parentPhone.trim();
      
      // Basic formatting attempt if user forgot '+'
      if (!phone.startsWith('+')) {
        if (phone.length === 10) {
          phone = '+91' + phone;
        } else if (phone.length > 10) {
          phone = '+' + phone;
        }
      }

      const body = customMessage 
        ? `School Transport Alert for ${student.name}: ${customMessage}`
        : `School Transport Update: ${student.name} ${messageSuffix}`;

      try {
        const result = await client.messages.create({
          body,
          from: twilioPhone,
          to: phone
        });
        results.push({ status: 'fulfilled', value: result });
      } catch (error) {
        results.push({ status: 'rejected', reason: error });
      }

      // Add a 500ms delay between messages to prevent Twilio rate limits (especially for siblings with same number)
      if (i < students.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      const errorDetails = failures.map((f: any) => ({
        message: f.reason?.message || 'Unknown error',
        code: f.reason?.code || 'No code',
        moreInfo: f.reason?.moreInfo || 'No more info'
      }));
      console.error('SMS sending failures details:', JSON.stringify(errorDetails, null, 2));
      const errorMessages = errorDetails.map((e: any) => `[${e.code}] ${e.message}`).join('; ');
      return NextResponse.json({ error: `SMS Error: ${errorMessages}` }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error sending SMS (Twilio API):', {
      message: error.message,
      code: error.code,
      status: error.status,
      moreInfo: error.moreInfo,
    });
    return NextResponse.json({ error: error.message || 'Failed to send SMS' }, { status: 500 });
  }
}
