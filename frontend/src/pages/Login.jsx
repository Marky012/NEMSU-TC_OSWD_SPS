import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Lock, Eye, EyeOff, Loader2, AlertTriangle, ShieldCheck } from "lucide-react";
import { TooltipBox } from '@/components/ui/tooltip';
import apiClient from "@/api/apiClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const PRIVACY_NOTICE_SECTIONS = [
  {
    title: "1. What We Collect",
    content: "We collect personal information you provide during registration and profiling, including but not limited to: full name, contact details, date of birth, address, academic information, family background, socioeconomic data, health/disability information, indigenous people membership, and other relevant data required for OSWD profiling purposes."
  },
  {
    title: "2. Purpose of Collection",
    content: "The collected data is used exclusively for: (a) student profiling and needs assessment by the Office of the Student Welfare and Development (OSWD); (b) determining eligibility for scholarships, grants, and other student support programs; (c) generating statistical reports for institutional planning and compliance with government agencies such as CHED and DSWD; and (d) enrollment verification through the OSWD verification system."
  },
  {
    title: "3. Legal Basis",
    content: "This data collection is undertaken pursuant to Republic Act No. 10173, otherwise known as the Data Privacy Act of 2012, and its Implementing Rules and Regulations. The processing of personal information is necessary for the performance of the university's mandated functions in student welfare and development under applicable laws and regulations."
  },
  {
    title: "4. Data Sharing and Access",
    content: "Your personal data will be accessed only by authorized OSWD personnel, the Registrar's Office for enrollment verification, and other NEMSU offices with legitimate educational interests. Aggregate or anonymized data may be shared with government agencies (CHED, DSWD, etc.) for statistical and reporting purposes as required by law. We do not sell, rent, or trade your personal information to third parties."
  },
  {
    title: "5. Data Retention",
    content: "Your personal data shall be stored and retained for as long as you are enrolled at NEMSU and for a period of five (5) years after graduation or separation from the university, after which it shall be disposed of in a secure manner in accordance with the university's records disposition schedule and NPC guidelines."
  },
  {
    title: "6. Your Rights as a Data Subject",
    content: "Under the Data Privacy Act, you have the right to: (a) be informed of how your data is being processed; (b) access your personal data; (c) object to the processing of your data; (d) rectify inaccurate or incomplete data; (e) request erasure or blocking of your data; (f) data portability; and (g) file a complaint with the National Privacy Commission if you believe your data privacy rights have been violated."
  },
  {
    title: "7. Security Measures",
    content: "NEMSU OSWD implements appropriate technical, organizational, and physical security measures to protect your personal information against unauthorized access, disclosure, alteration, loss, or destruction. These include secure servers, encrypted data transmission, access controls, and regular security audits."
  },
  {
    title: "8. Contact Information",
    content: "For inquiries, concerns, or requests regarding your personal data, you may contact the NEMSU Tagbina Campus OSWD."
  }
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

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [showConsent, setShowConsent] = useState(false);
  const [consenting, setConsenting] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState(null);

  const handleResend = async () => {
    if (!unverifiedEmail) return;
    setResending(true);
    setResendMessage("");
    try {
      await apiClient.post("/auth/resend-verification", { email: unverifiedEmail });
      setResendMessage("A new verification code has been sent!");
      setTimeout(() => setResendMessage(""), 4000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to resend code.");
    } finally {
      setResending(false);
    }
  };

  const handleAgreeAndProceed = async () => {
    setConsenting(true);
    try {
      await apiClient.post("/auth/privacy-consent");
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      storedUser.privacy_consent = true;
      localStorage.setItem('user', JSON.stringify(storedUser));
      setShowConsent(false);
      navigate(pendingRedirect || (storedUser?.role === 'admin' ? '/admin' : '/'));
    } catch (err) {
      setError("Failed to save consent. Please try again.");
    } finally {
      setConsenting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setUnverifiedEmail("");
    setResendMessage("");
    setLoading(true);
    const result = await login(email, password);
    if (result.success) {
      const storedUser = JSON.parse(localStorage.getItem('user'));
      const redirectTo = storedUser?.role === 'admin' ? '/admin' : '/';
      if (!storedUser.privacy_consent && storedUser.role !== 'admin') {
        setPendingRedirect(redirectTo);
        setShowConsent(true);
      } else {
        navigate(redirectTo);
      }
    } else {
      if (result.error?.toLowerCase?.()?.includes?.("verify your email")) {
        setUnverifiedEmail(email);
      }
      setError(result.error || "Invalid email or password");
    }
    setLoading(false);
  };

  return (
    <>
      <AuthLayout
        icon={LogIn}
        title="Welcome back"
        subtitle="Log in to your account"
        footer={
          <>
            Don't have an account?{" "}
            <Link to="/register" className="text-brand-blue font-medium hover:underline">
              Create one
            </Link>
          </>
        }
      >
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
            {unverifiedEmail && (
              <div className="mt-2 pl-6">
                <button
                  onClick={handleResend}
                  disabled={resending}
                  className="text-destructive font-medium hover:underline disabled:opacity-50 bg-transparent border-none cursor-pointer text-sm"
                >
                  {resending ? "Sending..." : "Resend verification code"}
                </button>
              </div>
            )}
          </div>
        )}

        {resendMessage && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm flex items-center gap-2">
            <span>{resendMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
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
                className="pl-10 h-12"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link to={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ''}`} className="text-xs text-brand-blue hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10 h-12"
                required
              />
              <TooltipBox label={showPassword ? 'Hide password' : 'Show password'}>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </TooltipBox>
            </div>
          </div>
          <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Logging in...
              </>
            ) : (
              "Log in"
            )}
          </Button>
        </form>
      </AuthLayout>

      <Dialog open={showConsent} onOpenChange={(open) => { if (!open) setShowConsent(false); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-brand-blue" />
              <DialogTitle>Data Privacy Notice</DialogTitle>
            </div>
            <DialogDescription>
              Before you can access the OSWD Student Profiling System, you must acknowledge and agree to the
              Data Privacy Notice in compliance with the Data Privacy Act of 2012 (Republic Act No. 10173).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pr-1">
            {PRIVACY_NOTICE_SECTIONS.map((section, i) => (
              <div key={i}>
                <h4 className="font-medium text-sm mb-1">{section.title}</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{section.content}</p>
              </div>
            ))}

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
              <p className="text-xs text-amber-800 leading-relaxed">
                <strong>By clicking "I Understand & Agree":</strong> You acknowledge that you have read and understood
                this Privacy Notice and voluntarily consent to the collection, processing, and storage of your personal
                information for the purposes described above. You confirm that the information you provide is accurate
                and complete to the best of your knowledge.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t mt-4">
            <Button variant="outline" onClick={() => { setShowConsent(false); setLoading(false); }}>
              Cancel
            </Button>
            <Button onClick={handleAgreeAndProceed} disabled={consenting} className="bg-brand-blue hover:bg-brand-blue/90">
              {consenting ? "Saving..." : "I Understand & Agree"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
