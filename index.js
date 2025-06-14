require('dotenv').config();

const debug = require('debug')('http');
const morgan = require('morgan');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const pdf = require('html-pdf-node');
const nodemailer = require('nodemailer');
const userModel = require('./models/user');
const app = express();

const KEY = process.env.KEY;
const dburi = process.env.DBURI;

const signature = {
  signed: KEY,
  maxAge: 2 * 24 * 60 * 60 * 1000,
};

const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};


mongoose.connect(dburi)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser(KEY));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Homepage
app.get('/', async (req, res) => {
  try {
    let user = null;
    let total = 0;

    if (req.signedCookies.user) {
      user = await userModel.findOne({ phone: req.signedCookies.user });
    }

    total = await userModel.aggregate([
      { $group: { _id: null, totalAmount: { $sum: "$amount" } } }
    ]);

    res.render('index', {
      user,
      totalDonated: total[0] ? total[0].totalAmount : 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

// Register routes
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/register.html'));
});

app.post('/register', async (req, res) => {
  try {
    debug(req.body);
    let user = await userModel.findOne({ phone: req.body.phone });

    if (!user) {
      user = await new userModel({
        name: req.body.name.toUpperCase(),
        bloodGroup: req.body.blood.toUpperCase() + req.body.rh,
        city: req.body.city.toUpperCase(),
        phone: req.body.phone,
        amount: req.body.amount || 0,
        address: req.body.address,
      }).save();
    }

    res.cookie('user', user.phone, signature);
    res.redirect('/donate');
  } catch (err) {
    res.status(500).send(err.message + '\nPlease go Back and try again.');
  }
});

// Donation logic
app.post('/donate', async (req, res) => {
  try {
    if (!req.body.amount || req.body.amount <= 0) {
      return res.redirect('back');
    }

    const user = await userModel.findOne({ phone: req.signedCookies.user });
    if (!user) return res.redirect('/logout');

    user.amount += parseFloat(req.body.amount);
    await user.save();

    res.redirect('/donate');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get('/donate', async (req, res) => {
  try {
    if (!req.signedCookies.user) return res.redirect('/register');

    const user = await userModel.findOne({ phone: req.signedCookies.user });
    if (!user) return res.redirect('/logout');

   res.render('donate', {
  user: {
    name: user.name,
    amount: user.amount,
    lastDonated: user.updatedAt.getTime() === user.createdAt.getTime()
      ? 'Never.'
      : user.updatedAt.toDateString(),
  },
});
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// Bank page
app.get('/bank', async (req, res) => {
  if (!req.signedCookies.user) return res.redirect('/register');

  try {
    let bloodQuery = req.query.blood || '(A|B|O|AB)';
    if (req.query.rh) bloodQuery += escapeRegExp(req.query.rh);
    else bloodQuery += '[\\+-]';

    const bloodRegex = new RegExp(bloodQuery, 'i');
    const cityRegex = new RegExp(req.query.city || '', 'i');
    const page = parseInt(req.query.page) || 1;

    const query = {
      $and: [
        { bloodGroup: { $regex: bloodRegex } },
        { city: { $regex: cityRegex } },
      ],
    };

    const docs = await userModel.find(query)
      .sort({ amount: -1 })
      .limit(18)
      .skip((page - 1) * 18);

    res.render('bank', { docs, logged: req.signedCookies.user });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading donors');
  }
});

// Logout
app.get('/logout', (req, res) => {
  res.clearCookie('user');
  res.redirect('/');
});

// Helper: Generate Certificate HTML
function generateCertificateHTML(user) {
  return `
    <html>
      <head>
        <style>
          body {
            font-family: 'Georgia', serif;
            text-align: center;
            padding: 40px;
            background-color: #fff8dc;
            border: 12px double goldenrod;
          }
          h1 {
            font-size: 32px;
            color: goldenrod;
            margin-bottom: 0;
          }
          h2 {
            font-size: 26px;
            margin: 5px 0 20px;
          }
          p {
            font-size: 18px;
            margin: 10px 0;
          }
          .signature-block {
            display: flex;
            justify-content: space-between;
            margin-top: 60px;
            font-size: 16px;
            padding: 0 40px;
          }
          .signature {
            text-align: center;
            width: 40%;
          }
          .signature-line {
            border-top: 1px solid #000;
            margin-top: 40px;
          }
        </style>
      </head>
      <body>
        <h1>CERTIFICATE<br/>OF APPRECIATION</h1>
        <p><strong>This certificate is proudly presented to</strong></p>
        <h2>${user.name}</h2>
        <p>in recognition of your generous act of donating blood at the</p>
        <p><strong>Blood Donation Camp organized by Vardaan</strong></p>
        <p>on <strong>${new Date(user.updatedAt).toDateString()}</strong></p>
        <p>Your kindness is deeply appreciated and has made a difference.</p>

        <div class="signature-block">
          <div class="signature-line-decorator"></div>
          <div class="signature">
            <div class="signature-line"></div>
            <p>Avineet Singh<br />Bloodline Coordinator</p>
          </div>
          <div class="signature-line-decorator"></div>
        </div>
      </body>
    </html>
  `;
}

// Route: Download PDF
app.get('/download-certificate/:id', async (req, res) => {
  try {
    const user = await userModel.findById(req.params.id);
    if (!user) return res.status(404).send('User not found');

    const file = { content: generateCertificateHTML(user) };
    const pdfBuffer = await pdf.generatePdf(file, { format: 'A4' });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${user.name}_certificate.pdf"`,
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to generate certificate');
  }
});

// Route: Email Certificate
app.get('/email-certificate/:id', async (req, res) => {
  try {
    const user = await userModel.findById(req.params.id);
    if (!user) return res.redirect('/bank?toast=User not found&type=error');

    const file = { content: generateCertificateHTML(user) };
    const emailTo = user.address;
    if (!emailTo) return res.redirect('/bank?toast=No email address found&type=error');

    const pdfBuffer = await pdf.generatePdf(file, { format: 'A4' });

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      }
    });

    await transporter.sendMail({
      from: `"Vardaan" <${process.env.MAIL_USER}>`,
      to: emailTo,
      subject: "Your Blood Donation Certificate",
      text: `Dear ${user.name},

Thank you for your selfless act of donating blood. Your contribution is not just appreciated — it’s *life-saving*.

Please find attached your Certificate of Blood Donation.

With gratitude,
Team Vardaan ❤️`,
      attachments: [{
        filename: `${user.name}_certificate.pdf`,
        content: pdfBuffer
      }]
    });

    res.send("Email sent successfully");
  } catch (err) {
    console.error(err);
    res.redirect('/bank?toast=Error occurred while sending email&type=error');
  }
});

// Server Start
const port = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`✅ Server running at http://localhost:${port}`);
  });
}

module.exports = app;
