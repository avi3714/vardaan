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

mongoose.connect(dburi, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true
}, (err) => {
  if (err) throw err;
  else console.log('Connected to mongoDb');
});

app.use(morgan('dev'));
app.use(express.static('public'));
app.use(express.static('public/js'));
app.use(express.static('public/css'));
app.use(express.static('public/img'));
app.use(express.static('public/json'));
app.use(cookieParser(KEY));
app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Homepage
app.get('/', async (req, res) => {
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
});



// Register routes
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/register.html'));
});


app.post('/register', (req, res) => {
  debug(req.body);
  userModel.findOne({ phone: req.body.phone })
    .then((user) => {
      if (user == null) {
        new userModel({
          name: req.body.name.toUpperCase(),
          bloodGroup: req.body.blood.toUpperCase() + req.body.rh,
          city: req.body.city.toUpperCase(),
          phone: req.body.phone,
          amount: req.body.amount || 0,
          address: req.body.address,
        }).save()
          .then((user) => {
            res.cookie('user', user.phone, signature);
            res.redirect('/donate');
          })
          .catch((err) => {
            res.send(err.message + '\nPlease go Back and try again.');
          });
      } else {
        res.cookie('user', user.phone, signature);
        res.redirect('/donate');
      }
    })
    .catch((err) => {
      res.send(err.message);
    });
});

// Donation logic
app.post('/donate', (req, res) => {
  if (req.body.amount == undefined || req.body.amount <= 0) {
    res.redirect('back');
    return;
  }
  userModel.findOne({ phone: req.signedCookies.user }, function (err, user) {
    if (err) res.send(err);
    if (!user) {
      res.redirect('/logout');
      return;
    }
    user.amount += parseFloat(req.body.amount);
    user.save({ validateBeforeSave: true })
      .then(res.redirect('/donate'))
      .catch((err) => {
        res.send(err.message);
      });
  });
});

app.get('/donate', (req, res) => {
  if (req.signedCookies.user) {
    userModel.findOne({ phone: req.signedCookies.user })
      .then((user) => {
        if (user == null) {
          res.redirect('/logout');
        } else {
          res.render('donate', {
            user: {
              name: user.name,
              amount: user.amount,
              lastDonated: user.createdAt - user.updatedAt == 0
                ? 'Never.'
                : user.updatedAt,
            },
          });
        }
      })
      .catch((err) => {
        console.error(err);
        res.send(err.message);
      });
  } else {
    res.redirect('/register');
  }
});

// Bank page
app.get('/bank', (req, res) => {
  if (req.signedCookies.user == null) {
    res.redirect('/register');
    return;
  }

  if (req.query.blood == undefined || req.query.blood == '')
    req.query.blood = '(A|B|O|AB)';

  if (req.query.rh != undefined) req.query.blood += escapeRegExp(req.query.rh);
  else req.query.blood += '[\\+-]';

  if (req.query.city == undefined) req.query.city = '';

  const page = req.query.page || 1;
  const query = {
    $and: [
      { bloodGroup: { $regex: req.query.blood, $options: 'i' } },
      { city: { $regex: req.query.city, $options: 'i' } },
    ],
  };

  userModel.find(query, null, {
    sort: { amount: -1 },
    limit: 18,
    skip: (page - 1) * 18,
  }, (err, docs) => {
    if (err) res.send(err);
    res.render('bank', { docs: docs, logged: req.signedCookies.user });
  });
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
  const user = await userModel.findById(req.params.id);
  if (!user) return res.status(404).send('User not found');

  const file = { content: generateCertificateHTML(user) };
  pdf.generatePdf(file, { format: 'A4' }).then(pdfBuffer => {
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${user.name}_certificate.pdf"`,
    });
    res.send(pdfBuffer);
  });
});

// Route: Email PDF
// Route: Email PDF with toast and redirect
app.get('/email-certificate/:id', async (req, res) => {
  const user = await userModel.findById(req.params.id);
  if (!user) return res.redirect('/bank?toast=User not found&type=error');

  const file = { content: generateCertificateHTML(user) };
  const emailTo = user.address;
  if (!emailTo) return res.redirect('/bank?toast=No email address found&type=error');

  pdf.generatePdf(file, { format: 'A4' }).then(async (pdfBuffer) => {
    try {
      let transporter = nodemailer.createTransport({
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
      res.redirect("Error occured!!");
    }
  });
});


// Server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log('App listening on port ' + port + '!');
});
