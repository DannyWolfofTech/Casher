/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
}

const LOGO_URL = 'https://ewnjmvxildwmbdmosasz.supabase.co/storage/v1/object/public/email-assets/logo-full.png'

export const EmailChangeEmail = ({ siteName, email, newEmail, confirmationUrl }: EmailChangeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email change for Casher</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} alt="Casher" height="40" style={logo} />
        <Heading style={h1}>Confirm your email change</Heading>
        <Text style={text}>
          You requested to change your Casher email from{' '}
          <Link href={`mailto:${email}`} style={link}>{email}</Link>{' '}
          to{' '}
          <Link href={`mailto:${newEmail}`} style={link}>{newEmail}</Link>.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Confirm Email Change
        </Button>
        <Text style={footer}>
          If you didn't request this change, please secure your account immediately.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Segoe UI', Arial, sans-serif" }
const container = { padding: '20px 25px' }
const logo = { margin: '0 0 24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#030712', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#64748b', lineHeight: '1.5', margin: '0 0 25px' }
const link = { color: '#00C853', textDecoration: 'underline' }
const button = { backgroundColor: '#00C853', color: '#ffffff', fontSize: '14px', borderRadius: '0.5rem', padding: '12px 20px', textDecoration: 'none', fontWeight: 'bold' as const }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
