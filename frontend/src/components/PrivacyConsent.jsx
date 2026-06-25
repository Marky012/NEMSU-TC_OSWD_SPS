import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldCheck, ExternalLink } from "lucide-react";

const PRIVACY_NOTICE_SECTIONS = [
  {
    title: "1. What We Collect",
    content: "We collect personal information you provide during registration and profiling, including but not limited to: full name, contact details, date of birth, address, academic information, family background, socioeconomic data, health/disability information, indigenous people membership, and other relevant data required for OSWD profiling purposes."
  },
  {
    title: "2. Purpose of Collection",
    content: "The collected data is used exclusively for: (a) student profiling and needs assessment by the Office of Student Welfare and Development (OSWD); (b) determining eligibility for scholarships, grants, and other student support programs; (c) generating statistical reports for institutional planning and compliance with government agencies such as CHED and DSWD; and (d) enrollment verification through the OSWD verification system."
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

export default function PrivacyConsent({ checked, onCheckedChange }) {
  const [modalOpen, setModalOpen] = useState(false);

  const handleAgreeAndContinue = () => {
    onCheckedChange(true);
    setModalOpen(false);
  };

  return (
    <>
      <div className="flex items-start gap-2.5">
        <Checkbox
          id="privacy-consent"
          checked={checked}
          onCheckedChange={onCheckedChange}
          className="mt-0.5 shrink-0"
          aria-label="I agree to the Data Privacy Policy"
        />
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground leading-relaxed">
            I agree to the{" "}
            <strong>Data Privacy Act of 2012 (RA 10173)</strong> and consent to the collection and processing of my
            personal information for OSWD profiling purposes.
          </p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1 text-xs text-brand-blue font-medium hover:underline bg-transparent border-none cursor-pointer"
          >
            <ExternalLink className="w-3 h-3" />
            View full privacy notice
          </button>
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-brand-blue" />
              <DialogTitle>NEMSU OSWD Data Privacy Notice</DialogTitle>
            </div>
            <DialogDescription>
              This Privacy Notice describes how the Office of Student Welfare and Development (OSWD) of North Eastern
              Mindanao State University collects, uses, and protects your personal information in compliance with the
              Data Privacy Act of 2012 (Republic Act No. 10173).
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
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAgreeAndContinue} className="bg-brand-blue hover:bg-brand-blue/90">
              I Understand & Agree
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
