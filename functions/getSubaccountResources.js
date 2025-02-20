const twilio = require("twilio");
exports.handler = async function (context, event, callback) {
  // Create a new Twilio client
  let client = context.getTwilioClient();
  // Create a twilio response
  const response = new Twilio.Response();
  response.appendHeader("Content-Type", "application/json");

  // Extract the subaccount SID from the incoming request
  const subaccountSid = event.subAccountSid;

  // Check if the subaccount SID is provided
  if (!subaccountSid) {
    console.log("Subaccount SID is required");
    response.setStatusCode(400);
    response.setBody("Subaccount SID is required");
  } else {
    try {
      // Create a new API Key for the subaccount
      // console.log("Creating new API Key for Subaccount: ", subaccountSid);
      const key = await client.iam.v1.newApiKey.create({
        accountSid: subaccountSid,
        friendlyName: "Temp Key to SubAccount info",
      });
      // console.log(`Temp Key Created: ${key.sid}`);

      // Creating new client to retrieve Sub Account info from that sub account.
      const newClient = twilio(key.sid, key.secret, {
        accountSid: subaccountSid,
      });

      // Get SIP Trunks
      const sipTrunks = await newClient.trunking.v1.trunks.list({ limit: 100 });
      // console.log("SIP Trunks: ", sipTrunks);
      // Get Emergency Addresses
      const addresses = await newClient.addresses.list({ limit: 20 });
      // console.log("Addresses: ", addresses);
      // Get Primary or Secondary Business Profiles
      const profiles = await newClient.trusthub.v1.customerProfiles.list({
        limit: 20,
      });
      // console.log("Profiles", profiles);
      // Get Trust Products
      const trustProducts = await newClient.trusthub.v1.trustProducts.list({
        limit: 20,
      });
      // console.log("Trust Products", trustProducts);
      // Combine all resources into a single JSON object
      const resources = {
        sipTrunks,
        addresses,
        profiles,
        trustProducts,
      };
      // console.log("Resources: ", resources);
      response.setStatusCode(200);
      response.setBody(resources);

      // Now delete that temp key
      await client.iam.v1.apiKey(key.sid).remove();
      // console.log("Temp Key removed");
    } catch (error) {
      response.setStatusCode(500);
      response.setBody(error);
      console.log(error);
    }
  }

  return callback(null, response);
};
