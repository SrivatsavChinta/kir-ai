import type { Metadata } from "next";

import { RegisterForm } from "@/components/auth/register-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a landlord account</CardTitle>
        <CardDescription>
          Your login is the owner of every record you add. Sample portfolio data is not copied
          onto new accounts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm />
      </CardContent>
    </Card>
  );
}
