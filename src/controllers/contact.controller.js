const ContactService = require("../services/contact.service");
const { successResponse, errorResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const { generatePagination } = require("../utils/pagination");

/**
 * Contact Controller - handles contact-related requests
 */
class ContactController {
  /**
   * Submit a contact query
   */
  static createContact = asyncHandler(async (req, res) => {
    const { name, email, query } = req.body;

    if (!name || !email || !query) {
      return errorResponse(res, "Missing required fields: name, email, query", 400);
    }

    const contact = await ContactService.create({ name, email, query });

    return successResponse(res, {
      message: "Contact query submitted successfully",
      data: contact,
    }, 201);
  });

  /**
   * Get all contact queries (Admin)
   */
  static getAllContacts = asyncHandler(async (req, res) => {
    const { contacts, pagination } = await ContactService.findAll(req.query || {});

    return successResponse(res, {
      message: "Contact queries fetched successfully",
      data: {
        contacts,
        pagination,
      },
    });
  });
}

module.exports = ContactController;
