"use client";

import { useState } from "react";
import Image from "next/image";
import { Button, Stack } from "react-bootstrap";

export type TotpSetupDetails = {
  secret: string;
  qrCode: string;
  algorithm: string;
  digits: number;
  periodSeconds: number;
};

type Copy = {
  qrTitle: string;
  unableToScan: string;
  scanBarcode: string;
  secret: string;
  type: string;
  typeTotp: string;
  algorithm: string;
  digits: string;
  period: string;
};

export function TotpSetupDetails({ setup, copy }: { setup: TotpSetupDetails; copy: Copy }) {
  const [manual, setManual] = useState(false);

  return manual ? (
    <Stack gap={2} className="small">
      <div>
        <div className="fw-semibold">{copy.secret}</div>
        <code className="d-block text-break">{setup.secret}</code>
      </div>
      <dl className="row mb-0">
        <dt className="col-5 fw-semibold">{copy.type}</dt>
        <dd className="col-7 mb-1">{copy.typeTotp}</dd>
        <dt className="col-5 fw-semibold">{copy.algorithm}</dt>
        <dd className="col-7 mb-1">{setup.algorithm}</dd>
        <dt className="col-5 fw-semibold">{copy.digits}</dt>
        <dd className="col-7 mb-1">{setup.digits}</dd>
        <dt className="col-5 fw-semibold">{copy.period}</dt>
        <dd className="col-7 mb-0">{setup.periodSeconds}</dd>
      </dl>
      <Button variant="link" className="align-self-start p-0" onClick={() => setManual(false)}>
        {copy.scanBarcode}
      </Button>
    </Stack>
  ) : (
    <Stack gap={2} className="align-items-center text-center">
      <div className="fw-semibold">{copy.qrTitle}</div>
      <Image
        src={setup.qrCode}
        width={220}
        height={220}
        role="img"
        alt={copy.qrTitle}
        unoptimized
        className="border rounded p-2 bg-body"
      />
      <Button variant="link" className="p-0" onClick={() => setManual(true)}>
        {copy.unableToScan}
      </Button>
    </Stack>
  );
}
