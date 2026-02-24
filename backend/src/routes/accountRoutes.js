import express from "express"
import { auth } from "../middleware/auth.js";
import { 
    listAccounts, 
    loginAccount, 
    registerAccount,
    requestEmailVerification,
    verifyEmail,
    requestPasswordReset,
    resetPassword,
    changePasswordFirstLogin,
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
router.post("/change-password-first-login", auth, changePasswordFirstLogin);

export default router;
