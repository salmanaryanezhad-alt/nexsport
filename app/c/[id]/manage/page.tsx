"use client";

import { ClubChrome } from "@/components/clubs/ClubChrome";
import { ClubManage } from "@/components/clubs/ClubManage";

export default function ClubManagePage() {
  return (
    <ClubChrome subtitle="مدیریت باشگاه">
      <ClubManage />
    </ClubChrome>
  );
}
