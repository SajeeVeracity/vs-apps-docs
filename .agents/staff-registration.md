# Staff registration runbook

Not published. Staff register an external developer's app and allow it in the customer organization. The quickstart's Part 2 step 2 sends the developer's request here.

## Input from the developer

- Manifest URL: `PUBLIC_BASE_URL` followed by `/api/manifest/hello-app`.
- Iframe URL: the client origin, not the manifest origin.
- Customer organization name.

## 1. Register and enable the app

Registration is staff-only: the controller is the cross-organization staff app registry, so no developer or space manager can do this.

1. Choose **Settings**, **Admin**, **Platform**, then **Apps**. Choose **Add app**.
2. Enter the manifest URL in **Manifest URL**. Choose **Continue**.
3. Check the key, name, version, page count and capability count against the developer's manifest.
4. Set **Iframe URL** to the developer's iframe URL. The field starts with the manifest origin.
5. Leave **Auto-apply manifest updates** off, Vector's default. Switch it on only when Vector decides to. Choose **Register**.
6. On the new row, choose **Edit**. Switch on **Enabled**. Choose **Save**.

Check: toast `App saved`. The row shows **Enabled**. The Space server must reach the manifest URL.

## 2. Allow the app in the license

**Add an app** lists the registration only after the organization license allows it.

1. Choose **Admin**, **Tenancy**, then **Organizations**. Choose **Edit license** on the organization.
2. Under **Allowed apps**, select the app chip. Choose **Save**.

Check: toast `License saved`. Tell the developer to continue at quickstart Part 2 step 3.

## Replace an existing registration

An existing registration blocks a new one. The Space refuses to delete it while any space holds the app. Open each space listed in the refusal, choose **Settings**, **Space**, **Context Hub**, **Resources**, and delete the app row. Then delete the registration under **Admin**, **Platform**, **Apps**.

## Open gap

No request channel exists. The quickstart tells developers to contact their Vector representative.
