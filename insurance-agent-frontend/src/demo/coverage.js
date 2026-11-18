const insuranceSubject = /\b(policy|endorsement|coverage|insurer)\b/i;
const coverageClause = /^([a-z ]+): (covered|excluded|see endorsement [a-z0-9-]+)\.?$/i;

export function analyzeCoverage(inbox, topic) {
  const insuranceMail = inbox.filter(({ subject }) => insuranceSubject.test(subject));
  const evidence = insuranceMail.flatMap((message) =>
    message.body.split('\n').flatMap((excerpt) => {
      const clause = excerpt.match(coverageClause);
      if (clause?.[1].toLowerCase() !== topic) return [];
      return [{ message, excerpt, finding: clause[2].toLowerCase() }];
    }),
  );

  const covered = evidence.some(({ finding }) => finding === 'covered');
  const excluded = evidence.some(({ finding }) => finding === 'excluded');
  const reference = evidence.find(({ finding }) => finding.startsWith('see endorsement '));
  const result = {
    classified: insuranceMail.length,
    scanned: inbox.length,
    evidence,
  };

  if (covered && excluded) {
    return { ...result, status: 'conflict', answer: 'The emails disagree about this coverage. Ask the insurer which document applies to your policy period before relying on either one.' };
  }
  if (covered || excluded) {
    return { ...result, status: covered ? 'covered' : 'excluded', answer: `The sample policy text lists ${topic} as ${covered ? 'covered' : 'excluded'}.` };
  }
  if (reference) {
    const endorsement = reference.finding.slice('see endorsement '.length).toUpperCase();
    return { ...result, status: 'missing', answer: `I can’t verify this coverage from the inbox. Ask your insurer for endorsement ${endorsement}, which the policy references.` };
  }
  return { ...result, status: 'missing', answer: 'I couldn’t find a policy clause about this in the sample inbox. Ask your insurer for the relevant coverage document.' };
}
