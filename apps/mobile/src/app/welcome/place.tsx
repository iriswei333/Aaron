import { WELCOME_RADIUS_RANGE, validateWelcomeStep } from '@sproutcue/shared/onboarding';
import { router } from 'expo-router';
import { useState } from 'react';

import { Stepper, TextField } from '@/components/ui';
import { FieldGroup } from '@/components/welcome/field-group';
import { useWelcome } from '@/components/welcome/welcome-context';
import { WelcomeStep } from '@/components/welcome/welcome-step';

export default function PlaceScreen() {
  const { draft, update } = useWelcome();
  const [status, setStatus] = useState('');

  function next() {
    const message = validateWelcomeStep(2, draft);
    setStatus(message);
    if (!message) router.push('/welcome/time');
  }

  return (
    <WelcomeStep
      step={2}
      title="Where do you usually play?"
      lede="We show your neighborhood, never your address. Your radius helps personalize playdates."
      primaryLabel="Continue"
      onPrimary={next}
      status={status}>
      <TextField labelVariant="caps" label="Neighborhood" value={draft.neighborhood} onChangeText={(neighborhood) => update({ neighborhood })} placeholder="Capitol Hill, Seattle" autoComplete="postal-address-locality" />
      <FieldGroup label="How far for a good playdate?">
        <Stepper
          label="Playdate radius"
          value={draft.radius}
          min={WELCOME_RADIUS_RANGE.min}
          max={WELCOME_RADIUS_RANGE.max}
          format={(value) => `${value} ${value === 1 ? 'mile' : 'miles'}`}
          onChange={(radius) => update({ radius })}
        />
      </FieldGroup>
    </WelcomeStep>
  );
}
