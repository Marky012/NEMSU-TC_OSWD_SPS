import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import apiClient from "@/api/apiClient";

const AuthLayout = ({ icon: Icon, title, subtitle, children, footer }) => (
  <div className="min-h-screen flex items-center justify-center bg-background p-4">
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-brand-blue/10 flex items-center justify-center mx-auto mb-4">
          {Icon && <Icon className="w-8 h-8 text-brand-blue" />}
        </div>
        <h1 className="font-heading text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>
      </div>
      <div className="bg-card rounded-xl border shadow-sm p-6">
        {children}
        {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </div>
  </div>
);

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";
  const codeParam = searchParams.get("code") || "";
  const [digits, setDigits] = useState(
    codeParam ? codeParam.split("").concat(Array(6).fill("")).slice(0, 6) : ["", "", "", "", "", ""]
  );
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (inputRefs.current[0]) inputRefs.current[0].focus();
  }, []);

  const handleDigitChange = (index, value) => {
    if (value && !/^\d$/.test(value)) return;
    const newDigits = [...digits];
    newDigits[index] = value;
    setDigits(newDigits);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").trim();
    const nums = pasted.replace(/\D/g, "").slice(0, 6).split("");
    const newDigits = ["", "", "", "", "", ""];
    nums.forEach((d, i) => { newDigits[i] = d; });
    setDigits(newDigits);
    const nextEmpty = newDigits.findIndex(d => !d);
    const focusIdx = nextEmpty === -1 ? 5 : nextEmpty;
    inputRefs.current[focusIdx]?.focus();
  };

  const code = digits.join("");

  const handleVerify = async (e) => {
    e.preventDefault();
    if (code.length !== 6) { setError("Please enter the complete 6-digit code."); return; }
    setError("");
    setLoading(true);
    try {
      await apiClient.post("/auth/verify-email", { email, code });
      setSuccess("Email verified successfully!");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err.response?.data?.detail || "Verification failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    setError("");
    try {
      const res = await apiClient.post("/auth/resend-verification", { email });
      const newCode = res.data?.verification_code;
      if (newCode) {
        setDigits(newCode.split("").concat(Array(6).fill("")).slice(0, 6));
        setSuccess(`A new code has been sent! Test mode code: ${newCode}`);
      } else {
        setDigits(["", "", "", "", "", ""]);
        setSuccess("A new code has been sent!");
      }
      if (inputRefs.current[0]) inputRefs.current[0].focus();
      setTimeout(() => setSuccess(""), 8000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to resend code.");
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout
      icon={success ? CheckCircle2 : Mail}
      title={success ? "Email Verified!" : "Verify your email"}
      subtitle={
        success
          ? "Redirecting to login..."
          : `Enter the 6-digit code sent to ${email}`
      }
      footer={
        !success && (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">
              Didn't receive the code?{" "}
              <button
                onClick={handleResend}
                disabled={resending}
                className="text-brand-blue font-medium hover:underline disabled:opacity-50 bg-transparent border-none cursor-pointer"
              >
                {resending ? "Sending..." : "Resend"}
              </button>
            </p>
            <Link to="/register" className="block text-brand-blue font-medium hover:underline text-sm">
              ← Back to registration
            </Link>
          </div>
        )
      }
    >
      {codeParam && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <strong>Test Mode:</strong> Your verification code is <span className="font-mono font-bold text-lg tracking-widest">{codeParam}</span>
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {success}
        </div>
      )}

      {!success && (
        <form onSubmit={handleVerify} className="space-y-6">
          <div className="space-y-2">
            <Label className="text-center block">Verification Code</Label>
            <div className="flex justify-center gap-2">
              {digits.map((digit, index) => (
                <Input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  className="w-12 h-14 text-center text-xl font-bold"
                  required
                />
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full h-12 font-medium" disabled={loading || code.length !== 6}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify email"
            )}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
