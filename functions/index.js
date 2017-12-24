const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const app = express();

admin.initializeApp(functions.config().firebase);

app.use(cors());
app.enable('trust proxy');

app.get('/products', (req, res) => {
	const products = require('./products.json');
	return res.json(products);
});

app.get('/client_token', (req, res) => {
	const { gateway } = require('./inits');
	return new Promise((resolve, reject) => {
		gateway.clientToken.generate({}, (err, response) => {
			if (err) {
				reject(err);
			}
			else {
				resolve(response);
			}
		});
	}).then(response =>
		res.json({
			token: response.clientToken
		})
	);
});

app.post('/checkout', (req, res) => {
	const { gateway } = require('./inits');
	// Use the payment method nonce here
	let nonceFromTheClient = req.body.paymentMethodNonce;
	let amount = req.body.amount;
	let items = req.body.items;
	let user = req.body.userData;
	// Create a new transaction for $10
	return new Promise((resolve, reject) => {
		gateway.transaction.sale(
			{
				amount,
				paymentMethodNonce: nonceFromTheClient,
				options: {
					// This option requests the funds from the transaction
					// once it has been authorized successfully
					submitForSettlement: true
				}
			},
			(error, result) => {
				if (error) {
					reject(error);
				}
				else {
					resolve(result);
				}
			}
		);
	})
		.then(result => {
			saveProduct(amount, user, items).then(ref => {
				res.send({
					success: true,
					order: {
						amount,
						user,
						products: items,
						id: ref.id
					}
				});
			});
		})
		.catch(error => {
			res.status(500).send(error);
		});
});

app.use('/orders', require('./orders'));

app.use('/econt', require('./econt'));

// Expose the API as a function
exports.api = functions.https.onRequest(app);

exports.sendEmail = functions.firestore
	.document('orders/{id}')
	.onCreate(event => {
		const { globalConfig } = require('./inits');
		const emailTemplates = require('./templates/email');
		const orderId = event.params.id;
		const data = event.data.data();
		data.orderId = orderId;

		const sendToCustomer = sendEmail({
			from: `${globalConfig.sender_name} <${globalConfig.sender_email}>`,
			to: data.user.email,
			subject: 'You order: ' + orderId,
			text: emailTemplates.customer(data, globalConfig)
		});
		const sendToAdmin = sendEmail({
			from: `${globalConfig.sender_name} <${globalConfig.sender_email}>`,
			to: globalConfig.admin_email,
			subject: 'You have new order ' + orderId,
			text: emailTemplates.admin(data, globalConfig)
		});

		return Promise.all([sendToAdmin, sendToCustomer]);
	});

function sendEmail({ from, to, subject, text }) {
	const emailData = {
		from,
		to,
		subject,
		//text
		html: text
	};

	return new Promise((resolve, reject) => {
		const { mailgun } = require('./inits');
		mailgun.messages().send(emailData, (error, body) => {
			if (error) {
				reject(error);
			}
			else {
				resolve(body);
			}
		});
	});
}

function saveProduct(amount, user, products) {
	return admin
		.firestore()
		.collection('orders')
		.add({
			amount,
			user,
			products
		});
}
