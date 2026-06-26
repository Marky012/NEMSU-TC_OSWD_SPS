import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Loader2, AlertTriangle, CheckCircle2, ArrowLeft, HelpCircle, Lock } from "lucide-react";
import apiClient from "@/api/apiClient";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState("email"); // email -> question -> reset
  const [email, setEmail] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiClient.post("/auth/security-question", { email });
      setQuestion(res.data.question);
      setStep("question");
    } catch (err) {
      setError(err.response?.data?.detail || "No account found with that email.");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!answer.trim()) { setError("Please enter your answer."); return; }
    setLoading(true);
    try {
      const res = await apiClient.post("/auth/verify-security-answer", { email, answer });
      setToken(res.data.token);
      setStep("reset");
    } catch (err) {
      setError(err.response?.data?.detail || "Incorrect answer. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      await apiClient.post("/auth/reset-password", { token, password });
      setSuccess("Password has been reset successfully!");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to reset password. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-brand-blue/10 flex items-center justify-center mx-auto mb-4">
            {step === "reset" && success ? (
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            ) : (
              <Lock className="w-8 h-8 text-brand-blue" />
            )}
          </div>
          <h1 className="font-heading text-2xl font-bold">
            {step === "email" && "Forgot Password"}
            {step === "question" && "Answer Security Question"}
            {step === "reset" && (success ? "Password Reset!" : "Reset Password")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {step === "email" && "Enter your email to look up your security question."}
            {step === "question" && "Answer the question you set during registration."}
            {step === "reset" && !success && "Enter your new password."}
            {success && "Redirecting to login..."}
          </p>
        </div>
        <div className="bg-card rounded-xl border shadow-sm p-6">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {step === "email" && !success && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12"
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Searching...</>
                ) : (
                  "Continue"
                )}
              </Button>
            </form>
          )}

          {step === "question" && !success && (
            <form onSubmit={handleAnswerSubmit} className="space-y-4">
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
                <div className="flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium mb-1">Security Question:</p>
                    <p className="text-base font-semibold">{question}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="answer">Your Answer</Label>
                <Input
                  id="answer"
                  type="text"
                  autoFocus
                  placeholder="Type your answer"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  className="h-12"
                  required
                />
              </div>
              <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying...</>
                ) : (
                  "Verify Answer"
                )}
              </Button>
            </form>
          )}

          {step === "reset" && !success && (
            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoFocus
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm New Password</Label>
                <Input
                  id="confirm"
                  type="password"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-12"
                  required
                />
              </div>
              <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Resetting...</>
                ) : (
                  "Reset Password"
                )}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center">
            {step === "question" ? (
              <button
                onClick={() => { setStep("email"); setError(""); }}
                className="text-sm text-brand-blue hover:underline inline-flex items-center gap-1 bg-transparent border-none cursor-pointer"
              >
                <ArrowLeft className="w-3 h-3" />
                Try a different email
              </button>
            ) : (
              <Link to="/login" className="text-sm text-brand-blue hover:underline inline-flex items-center gap-1">
                <ArrowLeft className="w-3 h-3" />
                Back to login
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
