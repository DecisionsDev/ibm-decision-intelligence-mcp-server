# Integrating the IBM Decision Intelligence MCP Server into IBM watsonx Orchestrate

## Specifying the API key and URL environment variables

You can use the connection setting to specity the API key and URL environment variables.

1. Open the main menu, expand **Manage**, and then click **Connections**. The Connection settings page opens.

   [![Thumbnail](./wxO-connection-01-thumbnail.png)](doc/wxO-connection-01.png)

2. Click **Add new connection** to launch the **Add new connection** wizard.

   [![Thumbnail](./wxO-connection-02-thumbnail.png)](doc/wxO-connection-02.png)

3. Enter the **Connection ID** and **Display name** fields, and then click **Save and continue**.

   [![Thumbnail](./wxO-connection-03-thumbnail.png)](doc/wxO-connection-03.png)

4. In the **Configure draft connection** panel:
   - Select **Key Value Pair** as **Authentication Type**.
   - Enter the **Key** and **Value** fields to define the `DI_APIKEY` environment variable.
   - Click **Add key value pair**.

   [![Thumbnail](./wxO-connection-04-thumbnail.png)](doc/wxO-connection-04.png)

5. Enter the **Key** and **Value** fields to define the `URL` environment variable, and then click **Connect**.

   [![Thumbnail](./wxO-connection-05-thumbnail.png)](doc/wxO-connection-05.png)

6. When the draft connection is connected, click **Next**.

   [![Thumbnail](./wxO-connection-06-thumbnail.png)](doc/wxO-connection-06.png)

7. Similarly configure the live connection. When it is done, click **Add connection**.

   [![Thumbnail](./wxO-connection-07-thumbnail.png)](doc/wxO-connection-07.png)

8. In the **Add MCP Server** wizard:
   - Select the display name corresponding to the connection you just configured.
   - Enter the `npx` command **WITHOUT** the `--di-apikey` and `--url` arguments.
   - Click **Connect**, and then click  **Done**.

    [![Thumbnail](./wxO-connection-08-thumbnail.png)](doc/wxO-connection-08.png)
