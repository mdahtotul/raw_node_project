/*
 * Title: Check Handler
 * Description: Route Check Handler
 * Copyright: Sumit Saha (Learn with Sumit)
 * Date: 24/11/2021
 */

// dependencies
const data = require("../../lib/data");
const { parseJSON, createRandomString } = require("../../helpers/utilities");
const tokenHandler = require("./tokenHandler");
const { maxChecks } = require("../../helpers/environments");

// module scaffolding
const handler = {};

handler.checkHandler = (requestProperties, callback) => {
   const acceptedMethods = ["get", "post", "put", "delete"];
   if (acceptedMethods.indexOf(requestProperties.method) > -1) {
      handler._check[requestProperties.method](requestProperties, callback);
   } else {
      callback(405);
   }
};

handler._check = {};

// get check
handler._check.get = (requestProperties, callback) => {};

// post check
handler._check.post = (requestProperties, callback) => {
   // validate inputs
   const protocol =
      typeof requestProperties.body.protocol === "string" &&
      ["http", "https"].indexOf(requestProperties.body.protocol) > -1
         ? requestProperties.body.protocol
         : false;

   const url =
      typeof requestProperties.body.url === "string" &&
      requestProperties.body.url.trim().length > 0
         ? requestProperties.body.url
         : false;

   const method =
      typeof requestProperties.body.method === "string" &&
      ["GET", "POST", "PUT", "DELETE"].indexOf(requestProperties.body.method) >
         -1
         ? requestProperties.body.method
         : false;

   const successCodes =
      typeof requestProperties.body.successCodes === "object" &&
      requestProperties.body.successCodes instanceof Array
         ? requestProperties.body.successCodes
         : false;

   const timeoutSeconds =
      typeof requestProperties.body.timeoutSeconds === "number" &&
      requestProperties.body.timeoutSeconds % 1 === 0 &&
      requestProperties.body.timeoutSeconds >= 1 &&
      requestProperties.body.timeoutSeconds <= 5
         ? requestProperties.body.timeoutSeconds
         : false;

   if (protocol && url && method && timeoutSeconds && successCodes) {
      // verify token
      const token =
         typeof requestProperties.headersObject.token === "string"
            ? requestProperties.headersObject.token
            : false;

      // lookup the user phone by reading the token
      data.read("tokens", token, (err1, tokenData) => {
         if (!err1 && tokenData) {
            const userPhone = parseJSON(tokenData).phone;
            // lookup the user data
            data.read("users", userPhone, (err2, userData) => {
               if (!err2 && userData) {
                  tokenHandler._token.verify(
                     token,
                     userPhone,
                     (tokenIsValid) => {
                        if (tokenIsValid) {
                           const userObject = parseJSON(userData);
                           const userChecks =
                              typeof userObject.checks === "object" &&
                              userObject.checks instanceof Array
                                 ? userObject.checks
                                 : [];

                           if (userChecks.length < maxChecks) {
                              const checkId = createRandomString(20);
                              const checkObject = {
                                 id: checkId,
                                 userPhone,
                                 protocol,
                                 url,
                                 method,
                                 successCodes,
                                 timeoutSeconds,
                              };
                              // save the object
                              data.create(
                                 "checks",
                                 checkId,
                                 checkObject,
                                 (err3) => {
                                    if (!err3) {
                                       // add check id to the user's object
                                       userObject.checks = userChecks;
                                       userObject.checks.push(checkId);

                                       // save the new user data
                                       data.update(
                                          "users",
                                          userPhone,
                                          userObject,
                                          (err4) => {
                                             if (!err4) {
                                                callback(200, checkObject);
                                             } else {
                                                callback(500, {
                                                   error: "There was a problem in the server side",
                                                });
                                             }
                                          }
                                       );
                                    } else {
                                       callback(500, {
                                          error: "There was a problem in the server side",
                                       });
                                    }
                                 }
                              );
                           } else {
                              callback(401, {
                                 error: "User already reached max check limit",
                              });
                           }
                        } else {
                           callback(403, {
                              error: "Token expired or Authentication failed",
                           });
                        }
                     }
                  );
               } else {
                  callback(403, {
                     error: "User not found",
                  });
               }
            });
         } else {
            callback(403, {
               error: "Authentication problem",
            });
         }
      });
   } else {
      callback(400, {
         error: "You have a problem in your request",
      });
   }
};

// put check
handler._check.put = (requestProperties, callback) => {};

// delete check
handler._check.delete = (requestProperties, callback) => {};

// exports module
module.exports = handler;