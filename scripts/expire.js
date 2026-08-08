const data = {
  fields: {
    validUntil: { stringValue: "2020-01-01T00:00:00.000Z" },
    status: { stringValue: "trial" } // keeping it trial but expired
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
