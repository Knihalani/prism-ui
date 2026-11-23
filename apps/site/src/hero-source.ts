export const heroInitial = { seats: 12 };
export const heroSource = `Start with the team you have today.

For :num[12]{id=seats min=1 max=50 step=1 label="Team size"} people at $18 per seat, that's **:calc[seats * 18]{format=currency decimals=0} / month**. Adjust the team size to make it yours.

\`\`\`ui:chart
{"type":"bar","title":"Room for what's next","x":"month","height":180,"series":[{"key":"people","label":"People"}],"data":[{"month":"Jan","people":4},{"month":"Feb","people":6},{"month":"Mar","people":7},{"month":"Apr","people":9},{"month":"May","people":10},{"month":"Jun","people":12}]}
\`\`\`

Choose how you'd like to pay:

\`\`\`ui:ask
{"id":"billing","title":"Billing cycle","submit":"Use this billing cycle","fields":[{"id":"cycle","label":"Pay","type":"select","options":["Monthly","Annually"],"value":"Monthly","required":true}]}
\`\`\``;
