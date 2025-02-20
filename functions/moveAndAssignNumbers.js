const twilio = require("twilio");

exports.handler = async function (context, event, callback) {
  // Create a new Twilio client
  let client = context.getTwilioClient();
  // Create a twilio response
  const response = new Twilio.Response();
  response.appendHeader("Content-Type", "application/json");

  // Extract the subaccount SID from the incoming request
  const phoneNumbers = event.phoneNumber;
  const subAccount = Array.isArray(event.subAccount)
    ? event.subAccount[0]
    : event.subAccount;
  const sipTrunk = Array.isArray(event.sipTrunk)
    ? event.sipTrunk[0]
    : event.sipTrunk;
  const address = Array.isArray(event.address)
    ? event.address[0]
    : event.address;
  const trustProducts = event.trustProduct;
  const profiles = event.profile;
  const resourceMove = [];

  console.log("Phone Numbers: ", phoneNumbers);
  console.log("Sub Account: ", subAccount);
  console.log("SIP Trunk: ", sipTrunk);
  console.log("Address: ", address);
  console.log("Trust Products: ", trustProducts);

  // Check if the subaccount SID is provided
  if (!phoneNumbers || !subAccount) {
    console.log("Subaccount and Phone Numbers are required");
    response.setStatusCode(400);
    response.setBody("Subaccount and Phone Numbers are required");
  } else {
    try {
      // Create a new API Key for the subaccount
      console.log("Creating new API Key for Subaccount: ", subAccount);
      const key = await client.iam.v1.newApiKey.create({
        accountSid: subAccount,
        friendlyName: "Temp Key to move and assign numbers",
      });
      console.log(`Temp Key Created: ${key.sid}`);

      // Creating new client to retrieve Sub Account info from that sub account.
      const newClient = twilio(key.sid, key.secret, {
        accountSid: subAccount,
      });

      // Fetch the full list of trust products
      const trustProductDetails = await getTrustProducts(newClient);
      const profileDetails = await getProfiles(newClient);

      // Move the number from the parent account to the subaccount
      for (const phoneNumber of phoneNumbers) {
        console.log(`Moving number: ${phoneNumber}`);
        try {
          const numberMove = await client
            .incomingPhoneNumbers(phoneNumber)
            .update({
              accountSid: subAccount,
              emergencyAddressSid: address ? address : null,
              emergencyEnabled: address ? true : false,
            });
          console.log(`Number moved: ${numberMove.sid}:`, numberMove);

          // Need to move to the proper SIP trunk.
          const trunkAssignment = await newClient.trunking.v1
            .trunks(sipTrunk)
            .phoneNumbers.create({
              phoneNumberSid: numberMove.sid,
            });
          console.log(`Number assigned to SIP Trunk: ${trunkAssignment.sid}`);

          // Process trust products in the specified order
          const primaryBusinessProfile = profileDetails.find((profile) => {
            console.log("Profile: ", profile);
            profile.policySid === "RN6433641899984f951173ef1738c3bdd0" &&
              profiles.includes(profile.sid);
          });
          const secondaryBusinessProfile = profileDetails.find(
            (profile) =>
              profile.policySid === "RNdfbf3fae0e1107f8aded0e7cead80bf5" &&
              profiles.includes(profile.sid)
          );

          if (primaryBusinessProfile) {
            console.log(
              "Assigning to primary business profile",
              primaryBusinessProfile
            );
            await assignToBusinessProfile(
              newClient,
              primaryBusinessProfile,
              numberMove.sid
            );
          } else if (secondaryBusinessProfile) {
            console.log(
              "Assigning to secondary business profile",
              secondaryBusinessProfile
            );
            await assignToBusinessProfile(
              newClient,
              secondaryBusinessProfile,
              numberMove.sid
            );
          } else {
            throw new Error(
              "Neither primary nor secondary business profile exists"
            );
          }

          const cnamProduct = trustProductDetails.find(
            (trustProduct) =>
              trustProduct.policySid === "RNf3db3cd1fe25fcfd3c3ded065c8fea53" &&
              trustProducts.includes(trustProduct.sid)
          );
          if (cnamProduct) {
            await assignToTrustProduct(newClient, cnamProduct, numberMove.sid);
          }

          const shstProduct = trustProductDetails.find(
            (trustProduct) =>
              trustProduct.policySid === "RN7a97559effdf62d00f4298208492a5ea" &&
              trustProducts.includes(trustProduct.sid)
          );
          if (shstProduct) {
            await assignToTrustProduct(newClient, shstProduct, numberMove.sid);
          }

          const voiceIntegrityProduct = trustProductDetails.find(
            (trustProduct) =>
              trustProduct.policySid === "RN5b3660f9598883b1df4e77f77acefba0" &&
              trustProducts.includes(trustProduct.sid)
          );
            if (voiceIntegrityProduct) {
            await assignToTrustProduct(
              newClient,
              voiceIntegrityProduct,
              numberMove.sid
            );
          }

          // Add the result to the resourceMove array
          resourceMove.push({
            phoneNumber: phoneNumber,
            numberMoveResult: numberMove,
            trunkAssignment: trunkAssignment,
          });
        } catch (error) {
          console.log(`Error moving number: ${phoneNumber}`, error);
          resourceMove.push({
            sid: phoneNumber,
            error: error,
          });
        }
      }

      // Now delete that temp key
      await client.iam.v1.apiKey(key.sid).remove();
      console.log("Temp Key removed normally");

      const resources = {
        sipTrunk,
        address,
        trustProducts,
        resourceMove,
      };
      response.setStatusCode(200);
      response.setBody(resources);
    } catch (error) {
      console.log(error);
      // Now delete that temp key if there was an error along the way
      await client.iam.v1.apiKey(key.sid).remove();
      console.log("Temp Key removed during error");
      response.setStatusCode(500);
      response.setBody(error);
    }
  }

  return callback(null, response);
};

// Helper function to assign phone number to a Business Profile
async function assignToBusinessProfile(
  client,
  businessProfile,
  phoneNumberSid
) {
  const result = await client.trusthub.v1
    .customerProfiles(businessProfile.sid)
    .customerProfilesChannelEndpointAssignment.create({
      channelEndpointSid: phoneNumberSid,
      channelEndpointType: "phone-number",
    });

  console.log(
    `Number assigned to Business Profile: ${businessProfile.sid}:`,
    result
  );
}

// Helper function to assign phone number to a trust product
async function assignToTrustProduct(client, trustProduct, phoneNumberSid) {
  const result = await client.trusthub.v1
    .trustProducts(trustProduct.sid)
    .trustProductsChannelEndpointAssignment.create({
      channelEndpointSid: phoneNumberSid,
      channelEndpointType: "phone-number",
    });
  console.log(`Number assigned to Trust Product: ${trustProduct.sid}:`, result);
}

// Helper function to get the list of trust products
async function getTrustProducts(client) {
  const trustProducts = await client.trusthub.v1.trustProducts.list({
    limit: 20,
  });
  console.log("TrustProducts", trustProducts);
  return trustProducts;
}

async function getProfiles(client) {
  const profiles = await client.trusthub.v1.customerProfiles.list({
    limit: 20,
  });
  console.log("Profiles", profiles);
  return profiles;
}
