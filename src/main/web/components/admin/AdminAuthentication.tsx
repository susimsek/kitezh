"use client";

import { useParams } from "@/routing/navigation";
import { useDictionary } from "@/i18n/client";
import { Navigate } from "react-router-dom";

import { AdminPageHeader } from "./AdminPageHeader";
import { useAdminAuth } from "./AdminAuthProvider";
import { DetailTabs } from "./DetailTabs";
import LoginSettings, { type LoginSettingsSection } from "./LoginSettings";

const POLICY_SECTIONS = ["password-policy", "otp-policy", "webauthn"] as const;
type PolicySection = (typeof POLICY_SECTIONS)[number];

function isPolicySection(value: string | undefined): value is PolicySection {
  return POLICY_SECTIONS.includes(value as PolicySection);
}

export default function AdminAuthentication() {
  const dictionary = useDictionary();
  const { access } = useAdminAuth();
  const { policy } = useParams<{ policy?: string }>();
  if (!access?.isAdmin) return <Navigate to="/auth-error?type=access_denied" replace />;
  const activePolicy: PolicySection = isPolicySection(policy) ? policy : "password-policy";
  const policyTabs = [
    {
      key: "password-policy",
      label: dictionary.admin.authentication.passwordPolicy,
      href: "/admin/authentication/policies/password-policy",
    },
    {
      key: "otp-policy",
      label: dictionary.admin.authentication.otpPolicy,
      href: "/admin/authentication/policies/otp-policy",
    },
    {
      key: "webauthn",
      label: dictionary.admin.authentication.webauthnPolicy,
      href: "/admin/authentication/policies/webauthn",
    },
  ];

  return (
    <>
      <AdminPageHeader
        title={dictionary.admin.authentication.title}
        description={dictionary.admin.authentication.subtitle}
      />
      <DetailTabs
        tabs={[
          {
            key: "policies",
            label: dictionary.admin.authentication.policies,
            href: "/admin/authentication",
          },
        ]}
        active="policies"
      />
      <section aria-labelledby="authentication-policies-title" className="d-grid gap-3">
        <div>
          <h2 id="authentication-policies-title" className="h5 mb-1">
            {dictionary.admin.authentication.policiesTitle}
          </h2>
          <p className="text-body-secondary mb-0">
            {dictionary.admin.authentication.policiesDescription}
          </p>
        </div>
        <DetailTabs tabs={policyTabs} active={activePolicy} />
        <LoginSettings embedded focusSection={activePolicy as LoginSettingsSection} />
      </section>
    </>
  );
}
