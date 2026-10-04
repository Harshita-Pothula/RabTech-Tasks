import { Router } from "express";

// Mock data for the first slice. Replace with a database later.
const APPLICATIONS = {
  HYD1234567: {
    status: "Appointment confirmed",
    nextStep: "Visit your Passport Seva Kendra on the booked date with your original documents."
  },
  HYD7654321: {
    status: "Police verification pending",
    nextStep: "No action needed. You will get an SMS when verification is complete."
  }
};

// 3 letters followed by 7 digits, e.g. HYD1234567
const FILE_NUMBER_PATTERN = /^[A-Z]{3}\d{7}$/;

export const statusRouter = Router();

statusRouter.get("/:fileNumber", (req, res) => {
  const fileNumber = req.params.fileNumber.trim().toUpperCase();

  // Server validates on its own, even if the client already checked
  if (!FILE_NUMBER_PATTERN.test(fileNumber)) {
    return res.status(400).json({
      error: "File number should be 3 letters followed by 7 digits, for example HYD1234567."
    });
  }

  const application = APPLICATIONS[fileNumber];
  if (!application) {
    return res.status(404).json({
      error: "We could not find that file number. Check it against your receipt and try again."
    });
  }

  res.json({ fileNumber, ...application });
});
