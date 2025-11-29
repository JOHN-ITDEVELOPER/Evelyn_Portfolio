import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const msg = {
    to: "johnnjenga7852@gmail.com", // YOUR email
    from: "noreply@yourdomain.com", // a verified sender on SendGrid
    subject: "New Inquiry from Portfolio Website",
    text: `
      Name: ${name}
      Email: ${email}
      Message:
      ${message}
    `,
  };

  try {
    await sgMail.send(msg);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Email failed to send" });
  }
}
