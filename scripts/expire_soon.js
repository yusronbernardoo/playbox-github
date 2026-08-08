const now = new Date();
const twoDaysFromNow = new Date(now.getTime() + (2 * 24 * 60 * 60 * 1000));

const data = {
  fields: {
    validUntil: { stringValue: twoDaysFromNow.toISOString() },
    status: { stringValue: "active" } // ensure it's active so it doesn't get blocked by suspend
  }
};

fetch("https://firestore.googleapis.com/v1/projects/playbox-os/databases/(default)/documents/stores/mabarps?updateMask.fieldPaths=validUntil&updateMask.fieldPaths=status", {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
})
.then(res => res.json())
.then(data => console.log("Done!", data))
.catch(console.error);
