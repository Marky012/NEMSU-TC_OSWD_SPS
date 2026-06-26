import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Mail, Lock, User, Loader2, ShieldCheck, Eye, EyeOff, HelpCircle } from "lucide-react";
import PrivacyConsent from "@/components/PrivacyConsent";

const SECURITY_QUESTIONS = [
  "What is your favorite pet?",
  "What is the name of your elementary school?",
  "What is the middle name of your mother?",
  "What is the name of your first teacher?",
  "What is your favorite book?",
];

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

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!privacyConsent) {
      setError("You must agree to the Data Privacy Policy to create an account.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!securityQuestion) {
      setError("Please select a security question.");
      return;
    }
    if (!securityAnswer.trim()) {
      setError("Please enter an answer to your security question.");
      return;
    }
    setLoading(true);
    const result = await register({ email, first_name: firstName || undefined, password, privacy_consent: true, security_question: securityQuestion, security_answer: securityAnswer });
    if (result.success) {
      const code = result.data?.verification_code;
      const params = new URLSearchParams({ email });
      if (code) params.set("code", code);
      navigate(`/verify-email?${params.toString()}`);
    } else {
      setError(result.error || "Registration failed");
    }
    setLoading(false);
  };

  return (
    <AuthLayout
      icon={UserPlus}
      title="Create your account"
      subtitle="Sign up to get started"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-brand-blue font-medium hover:underline">
            Log in
          </Link>
        </>
      }
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12 bg-white/50 focus:bg-white transition-colors"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="firstName" className="text-sm font-medium">First Name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="firstName"
              type="text"
              autoComplete="given-name"
              placeholder="Juan"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="pl-10 h-12 bg-white/50 focus:bg-white transition-colors"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 pr-10 h-12 bg-white/50 focus:bg-white transition-colors"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm" className="text-sm font-medium">Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="confirm"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 pr-10 h-12 bg-white/50 focus:bg-white transition-colors"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-card px-3 text-xs text-muted-foreground flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5" />
              Account Recovery
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Security Question</Label>
          <Select value={securityQuestion} onValueChange={setSecurityQuestion} required>
            <SelectTrigger className="h-12 bg-white/50 focus:bg-white">
              <SelectValue placeholder="-- Select a question --" />
            </SelectTrigger>
            <SelectContent>
              {SECURITY_QUESTIONS.map((q) => (
                <SelectItem key={q} value={q}>{q}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="securityAnswer" className="text-sm font-medium">Your Answer</Label>
          <div className="relative">
            <HelpCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="securityAnswer"
              type="text"
              placeholder="Enter your answer"
              value={securityAnswer}
              onChange={(e) => setSecurityAnswer(e.target.value)}
              className="pl-10 h-12 bg-white/50 focus:bg-white transition-colors"
              required
            />
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-card px-3 text-xs text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Data Privacy
            </span>
          </div>
        </div>

        <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4">
          <PrivacyConsent
            checked={privacyConsent}
            onCheckedChange={setPrivacyConsent}
          />
        </div>

        <Button type="submit" className="w-full h-12 font-medium shadow-sm hover:shadow-md transition-shadow" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating account...
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4 mr-2" />
              Create account
            </>
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}