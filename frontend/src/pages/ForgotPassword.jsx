import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Mail, ArrowLeft } from "lucide-react";

const AuthLayout = ({ icon: Icon, title, subtitle, children, footer }) => (
  <div className="min-h-screen flex items-center justify-center bg-background p-4">
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          {Icon && <Icon className="w-8 h-8 text-primary" />}
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

export default function ForgotPassword() {
  return (
    <AuthLayout
      icon={Mail}
      title="Reset password"
      subtitle="Coming soon"
      footer={
        <Link to="/login" className="text-primary font-medium hover:underline">
          <ArrowLeft className="w-3 h-3 inline mr-1" />Back to log in
        </Link>
      }
    >
      <p className="text-sm text-foreground text-center">
        Password reset feature is coming soon. Please contact the OSWD office for assistance.
      </p>
    </AuthLayout>
  );
}
