import express from "express"
import { 
    listAccounts, 
    loginAccount, 
    registerAccount,
    requestEmailVerification,
    verifyEmail,
    requestPasswordReset,
    resetPassword, 
} from "../controllers/accountController.js";

const router = express.Router();

router.get('/', listAccounts); 
router.post("/register", registerAccount);
router.post("/login", loginAccount);
router.post("/forgot-password", requestPasswordReset);
router.post("/reset-password", resetPassword);
router.post("/verify-email/request", requestEmailVerification);
router.post("/verify-email", verifyEmail);
router.post("/forgot-password", requestPasswordReset);
router.post("/reset-password", resetPassword);

export default router;
