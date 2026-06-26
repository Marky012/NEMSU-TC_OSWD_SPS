import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Loader2, CheckCircle2, ArrowLeft, HelpCircle, Eye, EyeOff, Copy, ClipboardCheck } from "lucide-react";
import apiClient from "@/api/apiClient";

const SECURITY_QUESTIONS = [
  "What is the name of your pet?",
  "What is your mother's maiden name?",
  "What is the name of your elementary school?",
  "What was the model of your first car?",
  "What city were you born in?",
];

export default function ForgotPassword() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [setupMode, setSetupMode] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [fallbackMessage, setFallbackMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleLookup = async (e) => {
    e.preventDefault();
    setError("");
    setFallbackMessage("");
    if (!email.trim()) { setError("Please enter your email."); return; }
    setLoading(true);
    setQuestion(null);
    try {
      const res = await apiClient.post("/auth/security-question", { email });
      if (res.data.fallback) {
        setFallbackMessage(res.data.message || "A password reset link has been sent to your email.");
      } else {
        setQuestion(res.data.question);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "No account found with that email.");
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async (e) => {
    e.preventDefault();
    setError("");
    if (!newQuestion) { setError("Please select a security question."); return; }
    if (!newAnswer.trim()) { setError("Please enter your answer."); return; }
    setLoading(true);
    try {
      const res = await apiClient.post("/auth/set-security-question", {
        email, security_question: newQuestion, security_answer: newAnswer,
      });
      setQuestion(res.data.question);
      setAnswer(newAnswer);
      setSetupMode(false);
      setFallbackMessage("");
      setError("");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to save security question.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    if (!answer.trim()) { setError("Please enter your answer."); return; }
    setVerifying(true);
    try {
      const res = await apiClient.post("/auth/verify-security-answer", { email, answer });
      setTempPassword(res.data.temp_password);
    } catch (err) {
      setError(err.response?.data?.detail || "Incorrect answer. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.querySelector("#temp-password");
      if (el) { el.select(); }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-brand-blue/10 flex items-center justify-center mx-auto mb-4">
            {tempPassword ? (
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            ) : (
              <HelpCircle className="w-8 h-8 text-brand-blue" />
            )}
          </div>
          <h1 className="font-heading text-2xl font-bold">
            {tempPassword ? "Password Revealed!" : "Forgot Password"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {tempPassword
              ? "Use this temporary password to log in."
              : setupMode
                ? "Set up a security question for your account."
                : "Verify your identity with your security question."}
          </p>
        </div>
        <div className="bg-card rounded-xl border shadow-sm p-6">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          {fallbackMessage && !setupMode && (
            <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
              Email sending is not available in this environment. Please set up a security question instead.
            </div>
          )}

          {tempPassword ? (
            /* Step 3: Show temp password */
            <div className="space-y-5">
              <div className="rounded-lg bg-green-50 border border-green-200 p-5 text-center">
                <p className="text-sm text-green-700 mb-3 font-medium">Your temporary password is:</p>
                <div className="flex items-center justify-center gap-2">
                  <Input
                    id="temp-password"
                    type={showPassword ? "text" : "password"}
                    value={tempPassword}
                    readOnly
                    className="w-40 h-12 text-center text-xl font-bold font-mono tracking-widest bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {copied ? <ClipboardCheck className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                For security, please change your password after logging in.
              </div>
              <Button className="w-full h-12 font-medium" onClick={() => window.location.href = "/login"}>
                Go to Login
              </Button>
            </div>
          ) : !question && !fallbackMessage ? (
            /* Step 1: Enter email */
            <form onSubmit={handleLookup} className="space-y-4">
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
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Looking up...</>
                ) : (
                  "Continue"
                )}
              </Button>
            </form>
          ) : setupMode ? (
            /* Step 1.5: Set up security question (fallback when none exists) */
            <form onSubmit={handleSetup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-question">Choose a Security Question</Label>
                <Select value={newQuestion} onValueChange={setNewQuestion}>
                  <SelectTrigger id="new-question" className="h-12">
                    <SelectValue placeholder="Select a question" />
                  </SelectTrigger>
                  <SelectContent>
                    {SECURITY_QUESTIONS.map((q) => (
                      <SelectItem key={q} value={q}>{q}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-answer">Your Answer</Label>
                <Input
                  id="new-answer"
                  type="text"
                  autoFocus
                  placeholder="Type your answer"
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                  className="h-12"
                  required
                />
              </div>
              <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  "Save & Continue"
                )}
              </Button>
              <button
                type="button"
                onClick={() => { setSetupMode(false); setFallbackMessage(""); setError(""); }}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer"
              >
                Try a different email
              </button>
            </form>
          ) : question ? (
            /* Step 2: Show question + answer */
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                <div className="flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 mt-0.5 shrink-0 text-blue-600" />
                  <div>
                    <p className="text-xs text-blue-600 font-medium uppercase tracking-wide mb-1">Your Security Question</p>
                    <p className="text-base font-semibold text-blue-900">{question}</p>
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
              <Button type="submit" className="w-full h-12 font-medium" disabled={verifying}>
                {verifying ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying...</>
                ) : (
                  "Reveal Password"
                )}
              </Button>
              <button
                type="button"
                onClick={() => { setQuestion(null); setError(""); }}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer"
              >
                Not your account? Use a different email
              </button>
            </form>
          ) : (
            /* Fallback: show setup button */
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Your account doesn't have a security question set yet.
              </p>
              <Button className="w-full h-12 font-medium" onClick={() => setSetupMode(true)}>
                Set Up Security Question
              </Button>
              <button
                type="button"
                onClick={() => { setFallbackMessage(""); setError(""); }}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer"
              >
                Try a different email
              </button>
            </div>
          )}

          {!tempPassword && (
            <div className="mt-6 text-center">
              <Link to="/login" className="text-sm text-brand-blue hover:underline inline-flex items-center gap-1">
                <ArrowLeft className="w-3 h-3" />
                Back to login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
