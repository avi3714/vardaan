module.exports = function generateCertificateHTML(user) {
  return `
    <html>
    <head>
      <style>
        body { font-family: Arial; padding: 20px; text-align: center; }
        h1 { color: crimson; }
        .details { margin-top: 30px; font-size: 18px; }
      </style>
    </head>
    <body>
      <h1>Blood Donation Certificate</h1>
      <p>This certificate is proudly presented to</p>
      <h2>${user.name}</h2>
      <div class="details">
        <p>Blood Group: <strong>${user.bloodGroup}</strong></p>
        <p>City of Donation: <strong>${user.city}</strong></p>
        <p>Amount Donated: <strong>${user.amount} Pint(s)</strong></p>
        <p>Date: ${new Date(user.createdAt).toDateString()}</p>
      </div>
      <p>Thank you for your contribution!</p>
    </body>
    </html>
  `;
}
