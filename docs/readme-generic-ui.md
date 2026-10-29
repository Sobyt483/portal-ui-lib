# Generic UI Components

A reusable set of Angular components for building consistent and maintainable micro frontends across the application.
This library provides generic implementations for common UI patterns like list views and detail views.

## Web Components

The generic ui consists of the following components:

- `generic-list-view`: Component for displaying and managing lists of resources, as well as creation, and deletion of the resources.
- `generic-detail-view`: Component for displaying individual resource.
- `search-list-dynamic-page`: Full-page list view with a Fiori Dynamic Page layout, paged table (via `mfp-declarative-table`), and optional create/edit form via `pm-resource-form-modal`.

## Configuration

### Namespace permissions

List and detail nodes that write or clear the core `namespace` parameter must declare:

```json
{
  "clientPermissions": {
    "urlParameters": {
      "namespace": { "read": true, "write": true }
    }
  }
}
```

Search List uses `~q`, `~page`, `~limit`, and `~tab` node parameters; it needs no core URL-parameter permissions. Old unprefixed search parameters are ignored.

### Generic List View

In order to use the generic list view, you need to adjust the node’s `content-configuration` to include the following:

- node properties
  - `"url": "/assets/platform-mesh-portal-ui-wc.js#generic-list-view"`: pointing to the web component.
  - `"webcomponent": {"selfRegistered": true, "type": "module"}`: indicating Luigi framework to register as a webcomponent.
  - `"navigationContext": "accounts"`: providing the navigation context for easy navigation between the entity and list views.

- context resource definition `"context"`
  - in the `"resourceDefinition"` the given fields need to be specified: `apiGroup, version, entityCollection, entity, scope, namespace` describing properties of the resource.
  - Also `"resourceDefinition"` have optional field `readyCondition` that describing when resource treated as ready
    It's an object that contains two fields:
    - `jsonPathExpression`: JSONPath expression used to evaluate whether the resource is ready at runtime
    - `property`: JSON path(s) used to generate GraphQL fields to fetch the necessary data for readiness evaluation
    ```json
    {
      "readyCondition": {
        "jsonPathExpression": "status.conditions[?(@.type=='Ready' && @.status=='True')]",
        "property": ["status.conditions.status", "status.conditions.type"]
      }
    }
    ```
  - `"availableWhenNotReady"`: Optional boolean (default: `false`). When set to
    `true`, a resource remains available for navigation and actions while its
    `readyCondition` evaluates to false. A resource with
    `metadata.deletionTimestamp` remains unavailable regardless of this setting.
  - `"resourceDefinition"` also accepts an optional `permissionsDefinition` object that enables instance and resource levels permission checks and gating:
    - `group`: API group of the resource (e.g. `"core.platform-mesh.io"`)
    - `resource`: plural resource name used as the permission key (e.g. `"HttpBins"`)
    - `entityActions`: array of actions checked per instance (e.g. `["get", "update", "delete"]`). Controls whether edit/delete buttons are shown on the detail view. When empty, no per-instance checks are performed.
    - `resourceActions`: array of resource-level actions (e.g. `["create", "list", "watch"]`).
    - `entityContextKey`: the context key used to resolve the current entity name for the permission lookup.

    ```json
    {
      "permissionsDefinition": {
        "group": "core.platform-mesh.io",
        "resource": "HttpBins",
        "entityActions": ["get", "update", "delete"],
        "resourceActions": ["create", "list", "watch"],
        "entityContextKey": "httpbindId"
      }
    }
    ```

    When permissions are known for a resource, the list view hides the create button when `create` is missing, skips list requests when `list` is missing, and does not open the live-update subscription when `watch` is missing. If permissions for the resource are unknown, everything is shown (fail-open).

    - in the `"ui"` part of the `"resourceDefinition"` we can specify:
      - `"logoUrl"`: resource type logo shown in the view header
      - view definitions for the corresponding views:

#### List View Configuration

- `"listView"`: Defines how resources are displayed in table format
  - `"resourceURL"`: Optional absolute path a **row click** navigates to, with `{resource.<dot.path>}` and `{context.<dot.path>}` placeholders resolved against the clicked row and the current Luigi context respectively (e.g. `"/workspaces/{context.organization}/components/{resource.metadata.name}"`). When set, it overrides the default relative navigation to the row's detail view — letting a flat/global list link into an entity-scoped path it cannot reach via the usual relative `navigate(name)`. Placeholders that resolve to `undefined` or `null` are left literal. Without `resourceURL`, a row click still requires a `detailView` to be present and navigates relatively to the row's own detail page.
  - `"fields"`: Array of `FieldDefinition` objects defining table columns. Each field's `"label"` becomes the column header, and `"property"` is a JSON path to the resource property. Fields can be grouped using the `"group"` property to display related information in a single column. The `"uiSettings"` property allows customization of rendering (format, actions, styling).
  - `"actions"`: Array of `FieldDefinition` objects with `displayAs: "button"` that render as row actions. In addition to navigation and modal actions, set `buttonSettings.action` to `"delete"` to open the resource deletion confirmation dialog. For example:
    ```json
    {
      "label": "Delete",
      "uiSettings": {
        "displayAs": "button",
        "buttonSettings": {
          "action": "delete",
          "icon": "delete",
          "design": "Negative"
        }
      }
    }
    ```
    The `navigate` / `openInModal` action path (`value` or `property`) supports the same `{context.<dot.path>}` runtime interpolation as `filters`.
  - `"resourceTitle"`: A `FieldDefinition` object for rendering the view title. Supports all field definition features like `uiSettings`, `value`, etc. If not provided, defaults to the plural form of the resource.
  - `"resourceDescription"`: A `FieldDefinition` object for rendering the subtitle description. Supports all field definition features. If not provided, a default description is generated.
  - `"filters"`: Optional array of `FieldFilterDefinition` objects rendered as filter tabs above the table. Each entry defines a tab that scopes the list to rows whose `"property"` equals the given `"value"` (sent to the OpenSearch backend as `<property>=<value>`). The strip renders exactly what you author — if you want an "All / no filter" affordance, add it as a regular entry (for example `{ "label": "All", "property": "<some-field>", "value": "*" }`). Properties per entry:
    - `"label"`: Tab text shown to the user.
    - `"property"`: Name of the resource property the filter applies to.
    - `"value"`: Value compared against `"property"` when the filter is active.
      - Supports **runtime interpolation from the Luigi context**: any occurrence of `{context.<dot.path>}` is replaced with the corresponding value from the current Luigi node context before the filter is applied. Examples:
        - `"value": "{context.userId}"` → resolves to the current user's ID (e.g. `"u1"`).
        - `"value": "/users/{context.userId}/orgs/{context.orgId}"` → multiple placeholders in one string are all resolved.
        - `"value": "{context.user.email}"` → nested paths are supported.
      - If a placeholder resolves to `undefined` or `null`, it is left literal in the output (so the user sees the placeholder rather than the string `"undefined"`) — a signal that the expected context key is missing.
    - `"default"`: Optional boolean; when `true`, this tab is selected on initial render. If omitted on every entry, the first entry in the array is selected. On Search List page load, the `~tab=<slug>` node parameter takes precedence when it matches a filter label converted to lowercase with whitespace replaced by hyphens. For example, `~tab=default-namespace` restores the tab labelled `Default namespace`; an unknown slug falls back to the configured default or first tab.
  - `"baselineFilter"`: Optional array of `FieldFilterDefinition` objects that are **always** merged into every OpenSearch request, regardless of which filter tab is selected. Unlike `filters`, baseline entries are **not** rendered as tabs and are **not** written to the URL. They are invisible to the user and act as a persistent query scope.
    - Each entry has the same `"property"` and `"value"` fields as a `filters` entry.
    - `"value"` supports the same `{context.<dot.path>}` runtime interpolation as `filters`. If a placeholder cannot be resolved (the context key is missing), that baseline entry is **silently skipped** (a `console.debug` message is logged) and the request proceeds without it. No error is thrown.
    - When a baseline filter and the selected tab filter set the **same property**, the **tab value wins** — the baseline value is overwritten by the tab.
    - Example — scope every list and count query to the current KCP workspace path:
      ```json
      "baselineFilter": [
        { "property": "workspace_path", "value": "{context.kcpPath}" }
      ]
      ```
      When the Luigi context provides `kcpPath: "/ws/my-workspace"`, every `listResources` call (both the main list and the per-tab count queries) will include `filters: { workspace_path: "/ws/my-workspace" }`. If `kcpPath` is absent from the context the entry is skipped and the request is sent without that filter.

#### Detail View Configuration

- `"detailView"`: Defines how a page view for individual resource is displayed
  - `"fields"`: Array of `FieldDefinition` objects defining which properties to display. Supports field grouping for a compact display of related data.
  - `"actions"`: Array of `FieldDefinition` objects whose `uiSettings.buttonSettings` render as action buttons in the detail view header, exactly as configured. Supported actions are `navigate`, `openInModal`, and `download-kubeconfig-from-secret-ref`; an action that cannot be executed shows an error alert when clicked. An action with `requirePermission` is hidden when the user lacks that permission. The existing `navigate` and `openInModal` actions use the URL from the field's `property` or static `value`, which supports `{context.<dot.path>}` runtime interpolation against the current Luigi node context; dynamic properties must also be present in `detailView.fields`, because ordinary actions do not add fields to the detail query. The `download-kubeconfig-from-secret-ref` action reads a core Kubernetes Secret and downloads one base64-encoded data key as YAML. Its `buttonSettings.resourceProperty` must resolve to the Secret name. For cross-namespace references, `buttonSettings.namespaceProperty` must resolve to the Secret namespace; when omitted, the resource namespace and then the current navigation namespace are used.
    ```json
    {
      "uiSettings": {
        "buttonSettings": {
          "action": "download-kubeconfig-from-secret-ref",
          "resourceProperty": "status.kubeconfig.secretRef.name",
          "text": "Download cluster kubeconfig",
          "icon": "download-from-cloud",
          "design": "Default",
          "tooltip": "Download cluster kubeconfig",
          "namespaceProperty": "status.kubeconfig.secretRef.namespace",
          "dataKey": "kubeconfig",
          "filename": "kubeconfig.yaml"
        }
      }
    }
    ```
    `buttonSettings.action: "download-kubeconfig-from-secret-ref"` is reserved for this operation. `resourceProperty` is required and resolves the Secret name. `namespaceProperty` is optional; for example, a namespace-local SimpleCluster reference uses `"resourceProperty": "status.kubeconfigSecretRef.name"` and omits `namespaceProperty`. `dataKey` defaults to `kubeconfig` and `filename` defaults to `kubeconfig.yaml`. The configured reference fields are included in the detail query automatically, and the action stays hidden until the Secret name and effective namespace resolve. The gateway and workspace RBAC must authorize reading the referenced Secret; use a dedicated kubeconfig Secret and least-privilege Secret-read RBAC.
  - `"showDownloadKubeconfig"`: Boolean to enable/disable download kubeconfig button (default: `false`).
  - `"resourceTitle"`: A `FieldDefinition` object for rendering the resource title. Supports all field definition properties including `property`, `jsonPathExpression`, `uiSettings`, etc. If not provided, defaults to the resource ID or display name.
  - `"resourceDescription"`: A `FieldDefinition` object for rendering the subtitle description. Supports all field definition properties. If not provided, a default description is generated.

#### Create View Configuration

- `"createView"`: Defines the shared form for creating and editing resources. Edit intentionally reuses `createView.fields` in both the table and detail views; there is no separate `editView` configuration. The detail view uses the `pm-resource-form-modal` facade, and the table uses the dialogs in `mfp-declarative-table-card`; both build their fields from the same configuration and use `mfp-resource-form-dialog` from `@openmfp/ngx`. The delete flow in the detail view uses `mfp-delete-confirmation-dialog` from `@openmfp/ngx` driven by signals (`deleteDialogOpen`, `deleteTarget`, `deleteConfig`).
  - `"fields"`: Array of `FieldDefinition` objects defining form fields. Supports `"required"` flag to indicate mandatory fields. Use `"values"` to provide a static list of options, or `"dynamicValuesDefinition"` to fetch options via GraphQL query (requires `"gqlQuery"`, `"operation"`, `"key"` for display value, and `"value"` for actual value). Fields that represent **arrays of objects** (e.g. `status.conditions`) are declared with a `"property"` pointing at the array + a nested `"propertyCollection"` of sub-`FieldDefinition`s — see the [`propertyCollection` reference](#field-definition-properties).
  - for namespaced resources, the create form automatically adds a required `metadata.namespace` field with dynamic namespace options **only when no namespace is already resolved** — i.e. no namespace is selected in the navigation context (`namespaceId`) and the URL search param `namespace` is `-all-` (or missing). When a namespace is already resolved it is reused on create, so the field is omitted.

On edit, `metadata.name`, `spec.alias`, `spec.type`, and `metadata.namespace` are shown but disabled.

#### Field Definition Properties

Each field definition supports the following properties:

- `"label"`: Display name for the field
- `"property"`: JSON path to the resource property (string or array of strings for fallback values)
- `"propertyField"`: In case the property is a scalar value that represents an object, this property can be used to specify the field to be used for display within that object
  - `"key"`: The name of the field to be used for display
  - `"transform"`: An array of text manipulations to be applied to the value, the available are:  
    | 'uppercase'
    | 'lowercase'
    | 'capitalize'
    | 'decode'
    | 'encode'
- `"jsonPathExpression"`: Alternative JSONPath expression for complex data access (takes precedence over `property`)
- `"required"`: Boolean flag indicating if the field is mandatory (for create views)
- `"requirePermission"`: Optional verb (e.g. `"update"`, `"delete"`) that gates rendering of this field per row. The field is shown when the verb is granted for the row, or while the row's permissions are still unknown; it is hidden once the row's permissions are known and the verb is absent. Fields without `requirePermission` always render. Commonly used on `displayAs: "button"` action fields to hide edit/delete buttons the user is not allowed to use.
- `"values"`: Array of predefined values for selection
- `"value"`: Static value for field
- `"inputType"`: Create/edit form control type (`"Text"`, `"Password"`, `"Switch"`). Use `"Switch"` for boolean toggles; table views use `uiSettings.displayAs: "boolIcon"` for read-only boolean icons instead.
- `"hint"`: Persistent help text below the create/edit form control; never submitted with the form.
- `"writeOnly"`: When `true`, the field is omitted from GraphQL read queries (including nested `propertyCollection` trees) and empty values are omitted on edit submit (e.g. secrets). Pair with `"inputType": "Password"` for masked secret inputs.
- `"placeholder"`: Functional placeholder on create/edit form inputs (not example help text — use `hint` for that).
- `"showPasswordToggle"`: When `inputType` is `"Password"`, show a show/hide toggle inside the input (defaults to ngx behaviour when omitted).
- `"group"`: Object for grouping related fields together:
  - `"name"`: Unique identifier for the group
  - `"label"`: Display name for the group
  - `"delimiter"`: String used to separate grouped values
  - `"multiline"`: Boolean flag for multiline display of grouped values (default: true) When true, values are displayed on separate lines
- `"uiSettings"`: Object for configuring UI-specific display settings:
  - `"labelDisplay"`: Boolean flag for applying the default emphasized style to the value
  - `"displayAs"`: Controls how the value is displayed (if nothing is provided the plain text is displayed):
    - `"secret"`: Render value as a secret with show/hide toggle
    - `"boolIcon"`: Render boolean-like values (true/false, True/False, TRUE/FALSE) as icon indicators
    - `"link"`: Render URL values as clickable links (supports http://, https://, ftp://, mailto:, tel: protocols)
    - `"tooltip"`: Render an icon with a tooltip; tooltip text is the field value
    - `"img"`: Render an image with the provided url read from the resource property
    - `"button"`: Render a button with the settings provided in the `buttonSettings` object
  - `"buttonSettings"`: Object for configuring button UI display settings (used when `displayAs: "button"`):
    - `"text"`: Button label text
    - `"icon"`: UI5 icon name to display at the start of the button
    - `"endIcon"`: UI5 icon name to display at the end of the button
    - `"design"`: Button design variant (options: `"Default"`, `"Positive"`, `"Negative"`, `"Transparent"`, `"Emphasized"`, `"Attention"`)
    - `"tooltip"`: Tooltip text shown on hover
    - `"action"`: Action to perform when button is clicked. `"openInModal"` and `"navigate"` use the URL from the field's `property` or static `value`; `"edit"` and `"delete"` are handled internally — `"delete"` is supported for `listView.actions` and opens the resource deletion confirmation dialog.
      - For `"navigate"` and `"openInModal"`, the resolved `value` (or `property`) supports the same `{context.<dot.path>}` **runtime interpolation** as `filters`: any occurrence of `{context.<dot.path>}` is replaced with the corresponding value from the current Luigi node context before the action runs (e.g. `"value": "/workspaces/{context.workspace}/create-component"`). Placeholders that resolve to `undefined` or `null` are left literal in the output.
    - `"modalSettings"`: Configuration for modal when `action: "openInModal"`:
      - `"title"`: Modal title
      - `"size"`: Predefined modal size (options: `"fullscreen"`, `"l"`, `"m"`, `"s"`)
      - `"width"`: Custom modal width (allowed units: `"px"`, `"%"`, `"rem"`, `"em"`, `"vh"`, `"vw"`)
      - `"height"`: Custom modal height (allowed units: `"px"`, `"%"`, `"rem"`, `"em"`, `"vh"`, `"vw"`)
  - `"tooltipIcon"`: UI5 icon name to use with `displayAs: "tooltip"` (defaults to `hint`) Don't forget to import picked icon to you portal from ui5 lib
  - `"withCopyButton"`: Boolean flag to show a copy button next to the value for easy copying to clipboard
  - `"cssCustomization"`: Inline styles applied to the rendered value (partial `CSSStyleDeclaration`, e.g. `backgroundColor`, `fontWeight`)
  - `"cssRules"`: Conditional inline styles applied based on the current value (merged on top of `cssCustomization`)
    - supported conditions: `equals`, `notEquals`, `greaterThan`, `greaterThanOrEqual`, `lessThan`, `lessThanOrEqual`, `contains`
- `"dynamicValuesDefinition"`: Configuration for dynamic value loading:
  - `"operation"`: GraphQL operation name
  - `"gqlQuery"`: GraphQL query string
  - `"gqlQueryVariables"` (optional): map of GraphQL query variables keyed by the `$var` name declared in `"gqlQuery"`. Each value may contain `{context.<dot.path>}` placeholders resolved against the current Luigi node context at runtime (e.g. `{context.namespaceId}`), or `{form.<property>}` placeholders resolved against the current form's values (e.g. `{form.metadata.namespace}` for a field that depends on another form field). Values without a placeholder are sent verbatim. An exact `{form.<property>}` placeholder preserves the form value's JSON type, including numbers, booleans, arrays and objects; a placeholder embedded in a larger string is interpolated as text. Form property names are exact flat control keys and may contain dots, hyphens and slashes. The variable's GraphQL type comes from the query string's own declaration, so it is not repeated here. Omitted entirely, no variables are sent and any `$vars` in the query stay `undefined`.
  - `"value"`: JSON path to the actual value in the response
  - `"key"`: JSON path to the display value in the response
- `"propertyCollection"`: Array of `FieldDefinition` objects describing **one entry** of an array-of-objects field. Set it alongside `"property"` (which points at the array itself, e.g. `"status.conditions"`) to declare that this field represents a repeatable object entry rather than a scalar. Each sub-field is a full `FieldDefinition` (label, property, values, required, uiSettings, and even nested `propertyCollection`s if you need array-of-array-of-object).
  - **Sub-field `"property"` paths**: authored the same way as top-level properties. Two authoring styles are equivalent and produce the same on-wire payload:
    - **Absolute** — the full JSON path (`"status.conditions.type"`). The generic UI strips the parent collection's `property` prefix internally so entries land as `{"type": "...", "status": "...", ...}` on the payload, not as flat dotted keys.
    - **Relative** — just the leaf name (`"type"`). Nothing to strip; same outcome.
  - Sub-fields inherit the same UI features as top-level fields: `"required"` (with `"validation": "onChange"` auto-enabled for required sub-fields), `"values"` for static selects, `"dynamicValuesDefinition"` for async selects, `"uiSettings"` for display customisation, `"disabled"` behaviour in edit mode, etc.
  - Nested `"propertyCollection"` is supported (array-of-objects-with-array-of-objects). The prefix-strip rule applies recursively — each nesting layer strips its own collection `property`.

#### Passing data back from a modal (`openInModal`)

When the micro-frontend opened inside the modal needs to signal a result back (e.g. after a form submit), close the modal using Luigi's `goBack` with a payload:

```ts
LuigiClient.linkManager().goBack({
  status: 'submit',
  action: 'create',
  resource: createdResource,
});
```

Luigi wraps the argument in a `{ data }` envelope which the parent view receives as the modal result. If the user dismisses the modal (e.g. close button or ESC) without calling `goBack`, no result data is available.

Supported values for the payload fields:

- `status`: `"submit"` | `"cancelled"`
- `action`: `"create"` | `"navigate"` | `"loadTableData"`
- `resource`: the affected resource object (optional, any type)

> **This is the only supported way to pass data back from the modal.** Any other mechanism (postMessage, shared state, etc.) is not handled by the library.

##### Example — an array of Kubernetes conditions

Declaring a `status.conditions` collection in `createView` (or in any other view that renders a `FieldDefinition`):

```json
{
  "label": "Conditions",
  "property": "status.conditions",
  "propertyCollection": [
    { "label": "Type", "property": "status.conditions.type" },
    { "label": "Status", "property": "status.conditions.status" },
    { "label": "Reason", "property": "status.conditions.reason" },
    { "label": "Message", "property": "status.conditions.message" }
  ]
}
```

At runtime this produces, in the edit form, a stack of cards — one per element of `status.conditions[]`. On submit, the payload is nested exactly as Kubernetes expects:

```json
{
  "status": {
    "conditions": [
      { "type": "Ready", "status": "True", "reason": "OK", "message": "…" },
      {
        "type": "Progressing",
        "status": "False",
        "reason": "Retry",
        "message": "…"
      }
    ]
  }
}
```

##### Example — dynamic values with query variables

Populating a select from a GraphQL query that takes variables. `userId` is resolved from the Luigi context at runtime via a `{context.<dot.path>}` placeholder, while `provider` is a fixed literal:

```json
{
  "label": "Region",
  "property": "spec.region",
  "required": true,
  "dynamicValuesDefinition": {
    "operation": "inventory.v1alpha1.Regions.items",
    "gqlQuery": "query ($userId: String, $provider: String) { inventory { v1alpha1 { Regions(userId: $userId, provider: $provider) { items { metadata { name } } } } } }",
    "gqlQueryVariables": {
      "userId": "{context.userId}",
      "provider": "aws"
    },
    "value": "metadata.name",
    "key": "metadata.name"
  }
}
```

##### Example — dependent form fields

Making one field's options depend on another field's value in the same form. The example wires a `spec.secretRef.name` select to the currently chosen `metadata.namespace`: picking a namespace loads the matching secrets, changing the namespace clears the secret and refetches, clearing the namespace leaves the secret empty.

Two pieces work together:

- `"gqlQueryVariables"` uses `{form.<property>}` placeholders to inject parent form values into the GraphQL query. Dependencies are inferred automatically from every placeholder in these variable values, including multiple placeholders in a single string. Repeated references to the same property count as one dependency. `{context.*}` placeholders and literal values do not create form dependencies. When a parent changes, the child's current value is cleared and its options are refetched.
- Both fields are top-level in the same `createView.fields` array. The dependency is one level deep: `spec.secretRef.name` depends on `metadata.namespace`, and `metadata.namespace` itself must not reference other form fields in its query variables.

```json
{
  "fields": [
    {
      "label": "Namespace",
      "property": "metadata.namespace",
      "required": true
    },
    {
      "label": "Secret",
      "property": "spec.secretRef.name",
      "required": true,
      "dynamicValuesDefinition": {
        "operation": "v1.Secrets.items",
        "gqlQuery": "query ($namespace: String!) { v1 { Secrets(namespace: $namespace) { items { metadata { name } } } } }",
        "gqlQueryVariables": {
          "namespace": "{form.metadata.namespace}"
        },
        "value": "metadata.name",
        "key": "metadata.name"
      }
    }
  ]
}
```

Behaviour at runtime:

| Situation | Child field value | Child field options |
|---|---|---|
| Create-open, parent empty | empty | empty — no query is sent |
| Parent gets a value | cleared | fetched for the current parent value |
| Parent cleared | cleared | empty — no query is sent |
| Edit-open with prefilled parent + child | both preserved | fetched for the loaded parent value |
| Request still in flight | — | submit is disabled until the request resolves |
| Stale response (parent changed again before the first response arrived) | — | discarded; only the latest response is applied |

Notes:

- Only one-level dependencies are supported. Duplicate field names, self-dependencies and transitive chains (A → B → C) prevent the dialog from opening and show an error alert.
- Multiple parents are allowed (for example, variable values containing `{form.a}` and `{form.b}`); the field stays empty until every in-form parent has a non-empty value.
- Multiple children may depend on the same parent — each is cleared and refetched independently.
- A parent absent from the form has no change trigger, but does not prevent the context-aware resolver from running. When `metadata.namespace` has no form value, `{form.metadata.namespace}` uses the effective context namespace, regardless of the GraphQL variable name. An empty in-form parent still blocks loading.
- The GraphQL variable named `namespace` also falls back to the effective context namespace when its configured value is empty or contains an unresolved placeholder. This convention applies only to namespaced resources. Other unresolved variables block the request; they do not receive an arbitrary context value.
- Resetting a dependent required field keeps submit disabled but hides its error until the user interacts with that field. Initial validation is preserved, and unchanged seed events from option updates do not repeat it.

#### Example Content Configuration for an Accounts Node

Below is an example content-configuration for an accounts node using the generic list view.

This example demonstrates various features including:

- **Secret fields**: The "Key" field in `listView` and "API Key" field in `detailView` use `displayAs: "secret"` to hide sensitive data with a toggle
- **Copy buttons**: Multiple fields include `withCopyButton: true` for easy copying to clipboard
- **Link display**: The "External URL" field uses `displayAs: "link"` to render URLs as clickable links
- **Boolean display**: The "Active" field uses `displayAs: "boolIcon"` to show boolean values as icons
- **Custom styling**: The "Key" and "Display Name" fields use `cssCustomization` for visual customization
- **Field grouping**: Contact information is grouped using the `group` property

```json
{
  "name": "accounts",
  "luigiConfigFragment": {
    "data": {
      "nodes": [
        {
          "pathSegment": "accounts",
          "navigationContext": "accounts",
          "label": "Accounts",
          "entityType": "main",
          "loadingIndicator": {
            "enabled": false
          },
          "keepSelectedForChildren": true,
          "url": "/assets/platform-mesh-portal-ui-wc.js#generic-list-view",
          "webcomponent": {
            "selfRegistered": true,
            "type": "module"
          },
          "context": {
            "resourceDefinition": {
              "apiGroup": "core_platform_mesh_io",
              "version": "v1alpha1",
              "entityCollection": "Accounts",
              "entity": "Account",
              "scope": "Cluster",
              "namespace": null,
              "readyCondition": {
                "jsonPathExpression": "status.conditions[?(@.type=='Ready' && @.status=='True')]",
                "property": [
                  "status.conditions.status",
                  "status.conditions.type"
                ]
              },
              "ui": {
                "logoUrl": "https://www.kcp.io/icons/logo.svg",
                "resourceImageProperty": "spec.image",
                "listView": {
                  "resourceTitle": {
                    "value": "Accounts"
                  },
                  "resourceDescription": {
                    "value": "This page displays all accounts in your environment. You can create, edit, or delete accounts as needed."
                  },
                  "fields": [
                    {
                      "property": "metadata.imgUrl",
                      "uiSettings": {
                        "displayAs": "img"
                      }
                    },
                    {
                      "label": "Name",
                      "property": "metadata.name"
                    },
                    {
                      "label": "Display Name",
                      "property": "spec.displayName"
                    },
                    {
                      "label": "Key",
                      "property": "data",
                      "propertyField": {
                        "key": "OPENAI_API_KEY",
                        "transform": ["uppercase", "encode"]
                      },
                      "uiSettings": {
                        "displayAs": "secret",
                        "withCopyButton": true,
                        "cssCustomization": {
                          "backgroundColor": "#e3f2fd",
                          "color": "#1976d2",
                          "fontWeight": "bold",
                          "textTransform": "uppercase"
                        }
                      }
                    },
                    {
                      "label": "Type",
                      "property": "spec.type"
                    },
                    {
                      "label": "Contact Info",
                      "property": "spec.email",
                      "group": {
                        "name": "contact",
                        "label": "Contact Information",
                        "delimiter": " | "
                      }
                    },
                    {
                      "label": "Phone",
                      "property": "spec.phone",
                      "group": {
                        "name": "contact",
                        "label": "Contact Information",
                        "delimiter": " | "
                      }
                    },
                    {
                      "value": "/home/members",
                      "group": {
                        "label": "Actions",
                        "name": "actions",
                        "multiline": false
                      },
                      "uiSettings": {
                        "displayAs": "button",
                        "buttonSettings": {
                          "text": "Now",
                          "endIcon": "download-from-cloud",
                          "design": "Emphasized",
                          "tooltip": "It is about time!",
                          "action": "openInModal",
                          "modalSettings": {
                            "title": "Time is precious",
                            "size": "l"
                          }
                        }
                      }
                    },
                    {
                      "property": "metadata.annotations.actionURL",
                      "group": {
                        "label": "Actions",
                        "name": "actions",
                        "multiline": false
                      },
                      "uiSettings": {
                        "displayAs": "button",
                        "buttonSettings": {
                          "text": "Download",
                          "icon": "delete",
                          "design": "Default",
                          "tooltip": "Hello there!",
                          "action": "navigate"
                        }
                      }
                    }
                  ]
                },
                "detailView": {
                  "resourceTitle": {
                    "property": "spec.displayName"
                  },
                  "resourceDescription": {
                    "property": "spec.description"
                  },
                  "actions": [
                    {
                      "value": "/accounts/namesapces",
                      "uiSettings": {
                        "displayAs": "button",
                        "buttonSettings": {
                          "text": "Now",
                          "endIcon": "download-from-cloud",
                          "design": "Emphasized",
                          "tooltip": "It is about time!",
                          "action": "openInModal",
                          "modalSettings": {
                            "title": "Time is precious",
                            "size": "m"
                          }
                        }
                      }
                    }
                  ],
                  "fields": [
                    {
                      "label": "Description",
                      "property": "spec.description"
                    },
                    {
                      "label": "Display Name",
                      "property": "spec.displayName",
                      "uiSettings": {
                        "cssCustomization": {
                          "color": "#2e7d32",
                          "fontWeight": "600"
                        },
                        "cssRules": [
                          {
                            "if": { "condition": "equals", "value": "High" },
                            "styles": { "color": "red" }
                          },
                          {
                            "if": { "condition": "equals", "value": "Medium" },
                            "styles": { "color": "orange" }
                          },
                          {
                            "if": { "condition": "equals", "value": "Low" },
                            "styles": { "color": "green" }
                          }
                        ]
                      }
                    },
                    {
                      "label": "API Key",
                      "property": "spec.credentials.apiKey",
                      "uiSettings": {
                        "displayAs": "secret",
                        "withCopyButton": true
                      }
                    },
                    {
                      "label": "Account ID",
                      "property": "metadata.uid",
                      "uiSettings": {
                        "withCopyButton": true
                      }
                    },
                    {
                      "label": "External URL",
                      "property": "spec.externalUrl",
                      "uiSettings": {
                        "displayAs": "link",
                        "withCopyButton": true
                      }
                    },
                    {
                      "label": "Active",
                      "property": "spec.active",
                      "uiSettings": {
                        "displayAs": "boolIcon"
                      }
                    },
                    {
                      "label": "Contact Info",
                      "property": "spec.email",
                      "group": {
                        "name": "contact",
                        "label": "Contact Information",
                        "delimiter": " | "
                      }
                    },
                    {
                      "label": "Phone",
                      "property": "spec.phone",
                      "group": {
                        "name": "contact",
                        "label": "Contact Information",
                        "delimiter": " | "
                      }
                    }
                  ]
                },
                "createView": {
                  "fields": [
                    {
                      "label": "Name",
                      "property": "metadata.name",
                      "required": true
                    },
                    {
                      "label": "Type",
                      "property": "spec.type",
                      "required": true,
                      "values": ["account"]
                    },
                    {
                      "label": "Display Name",
                      "property": "spec.displayName"
                    },
                    {
                      "label": "Conditions",
                      "property": "status.conditions",
                      "propertyCollection": [
                        {
                          "label": "Type",
                          "property": "status.conditions.type"
                        },
                        {
                          "label": "Message",
                          "property": "status.conditions.message"
                        }
                      ]
                    },
                    {
                      "label": "Description",
                      "property": "spec.description"
                    },
                    {
                      "label": "City",
                      "property": "spec.city",
                      "required": true,
                      "dynamicValuesDefinition": {
                        "operation": "cities",
                        "gqlQuery": "subscription { cities { data { id name } } }",
                        "value": "data.id",
                        "key": "data.name"
                      }
                    }
                  ]
                }
              }
            }
          },
          "children": [
            {
              "pathSegment": ":accountId",
              "hideFromNav": true,
              "keepSelectedForChildren": false,
              "defineEntity": {
                "id": "account",
                "contextKey": "accountId",
                "dynamicFetchId": "account"
              },
              "context": {
                "accountId": ":accountId",
                "resourceId": ":accountId"
              }
            }
          ]
        }
      ]
    }
  }
}
```

#### Example Content Configuration for an HttpBin Node with Namespaced Scope

```json
{
  "name": "httpbins",
  "creationTimestamp": "2022-05-17T11:37:17Z",
  "luigiConfigFragment": {
    "data": {
      "nodes": [
        {
          "pathSegment": "orchestrate_platform-mesh_io_httpbins",
          "navigationContext": "orchestrate_platform-mesh_io_httpbins",
          "label": "Http Bins",
          "icon": "paint-bucket",
          "order": 800,
          "entityType": "main.core_platform-mesh_io_account.namespace",
          "loadingIndicator": {
            "enabled": false
          },
          "keepSelectedForChildren": true,
          "url": "/assets/platform-mesh-portal-ui-wc.js#generic-list-view",
          "webcomponent": {
            "selfRegistered": true,
            "type": "module"
          },
          "context": {
            "resourceDefinition": {
              "apiGroup": "orchestrate_platform_mesh_io",
              "entityCollection": "HttpBins",
              "entity": "HttpBin",
              "version": "v1alpha1",
              "scope": "Namespaced",
              "namespace": null,
              "readyCondition": {
                "jsonPathExpression": "status.ready",
                "property": ["status.ready"]
              },
              "ui": {
                "logoUrl": "https://www.kcp.io/icons/logo.svg",
                "listView": {
                  "fields": [
                    {
                      "label": "Name",
                      "property": "metadata.name"
                    },
                    {
                      "label": "Ready",
                      "property": "status.ready",
                      "uiSettings": {
                        "displayAs": "boolIcon"
                      }
                    },
                    {
                      "label": "Link",
                      "property": "status.url",
                      "uiSettings": {
                        "displayAs": "link"
                      }
                    }
                  ]
                },
                "detailView": {},
                "createView": {
                  "fields": [
                    {
                      "label": "Name",
                      "property": "metadata.name",
                      "required": true
                    }
                  ]
                }
              }
            }
          },
          "children": [
            {
              "pathSegment": ":httpbinId",
              "hideFromNav": true,
              "keepSelectedForChildren": false,
              "defineEntity": {
                "id": "orchestrate_platform-mesh_io_httpbin",
                "contextKey": "httpbinId"
              },
              "context": {
                "accountId": ":accountId",
                "namespaceId": ":namespaceId",
                "resourceId": ":httpbinId"
              }
            }
          ]
        },
        {
          "entityType": "main.core_platform-mesh_io_account.namespace.orchestrate_platform-mesh_io_httpbin",
          "pathSegment": "dashboard",
          "label": "Dashboard",
          "url": "/assets/platform-mesh-portal-ui-wc.js#generic-detail-view",
          "webcomponent": {
            "selfRegistered": true,
            "type": "module"
          },
          "defineEntity": {
            "id": "dashboard"
          },
          "compound": {
            "children": []
          }
        }
      ]
    }
  }
}
```

### Search List Dynamic Page

A full-page list view using the SAP Fiori `ui5-dynamic-page` layout. Use it when you want a DynamicPage header (collapsible, with branding and action toolbar) combined with a paginated Fiori table.

**Web component selector:** `search-list-dynamic-page`

**URL:** `/assets/platform-mesh-portal-ui-wc.js#search-list-dynamic-page`

**Key behaviour:**

- Table is rendered via `mfp-declarative-table`, columns driven by `resourceDefinition.ui.listView.fields`.
- Pagination is page-based (`loadMode: pager`). Current page and limit are persisted as `~page` / `~limit` Luigi node parameters (default values `page=1` and `limit=20` are omitted). Invalid pages fall back to 1; supported limits are 5, 10, 20, 50, and 100, with 20 as the fallback. Changing the search query, filter tab, or page size resets the page to 1.
- Data is fetched directly via `OpenSearchService` against the OpenSearch API configured in `portalContext.openSearchApiUrl`.
- If `resourceDefinition.ui.listView.filters` is set, a tab strip is rendered above the table — one tab per filter entry. Each tab shows the item count in parentheses. The active tab is persisted as the `~tab=<slug>` node parameter in the URL. See [List View Configuration](#list-view-configuration) for the full `filters` schema.
- If `resourceDefinition.ui.createView.fields` is set and the user has `create` permission, a **Create** button appears in the toolbar, which opens `pm-resource-form-modal` — a facade component wrapping `mfp-resource-form-dialog` from `@openmfp/ngx`.
- If `resourceDefinition.readyCondition` is set, a status-alert column is prepended to the table.
- A **search input** is rendered in the page header. The search fires only when the user presses **Enter** or clicks the search icon — it does not filter as-you-type. The current query is persisted as the `~q` node parameter; clearing the input and re-submitting removes it. On reload, the desanitised node parameter restores the input, including special characters. An empty or whitespace-only query is sent to OpenSearch as `q: "*"` (match all).
- **Error handling**: the table shows an inline error state when a request fails. A retry button is rendered; clicking it re-triggers the current list request. If the user lacks `list` permission, a 403 error is shown without making a network call.

**Test IDs:**

| `data-testid`                          | Element                                                | Notes                                                                                                                      |
| -------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `search-list-dynamic-page`             | Root `<ui5-dynamic-page>`                              |                                                                                                                            |
| `search-list-title`                    | Page title (expanded heading)                          |                                                                                                                            |
| `search-list-description`              | Page description paragraph (expanded heading)          |                                                                                                                            |
| `search-list-snapped-title`            | Page title (snapped/collapsed heading)                 |                                                                                                                            |
| `search-list-snapped-description`      | Page description paragraph (snapped/collapsed heading) |                                                                                                                            |
| `search-list-actions-toolbar`          | Toolbar in the title area                              |                                                                                                                            |
| `search-list-create-button`            | Create toolbar button                                  | Only rendered when `createView.fields` is set and user has `create` permission                                             |
| `search-list-action-{action.property}` | Each action rendered via `mfp-resource-field`          | Dynamic — one per entry in `listView.actions`; the button inside gets `{action.property}-button` from the library          |
| `search-list-search-input`             | Search input field                                     |                                                                                                                            |
| `search-list-search-icon`              | Search submit icon (click or Enter)                    |                                                                                                                            |
| `search-list-clear-icon`               | Clear search icon                                      | Hidden when input is empty                                                                                                 |
| `search-list-tab-container`            | Filter tab strip                                       | Only rendered when `listView.filters` is set                                                                               |
| `search-list-tab-{i}`                  | Individual filter tab at index `i`                     | Dynamic — `i` is 0-based                                                                                                   |
| `search-list-table`                    | `mfp-declarative-table`                                | Internal table elements use `generic-table-*` test IDs from `@openmfp/ngx`                                                 |
| `search-list-create-modal`             | `pm-resource-form-modal`                               | The facade wraps `mfp-resource-form-dialog` from `@openmfp/ngx`; internal dialog elements use `create-resource-*` test IDs |

**Minimal node configuration:**

```json
{
  "url": "/assets/platform-mesh-portal-ui-wc.js#search-list-dynamic-page",
  "webcomponent": { "selfRegistered": true, "type": "module" },
  "context": {
    "resourceDefinition": {
      "apiGroup": "example.io",
      "version": "v1alpha1",
      "entityCollection": "widgets",
      "entity": "Widget",
      "scope": "Namespaced",
      "ui": {
        "listView": {
          "fields": [
            { "property": "metadata.name", "label": "Name" },
            { "property": "spec.description", "label": "Description" }
          ]
        },
        "detailView": { "fields": [] }
      }
    }
  }
}
```

### Generic Detail View

To use the generic detail view, update the node’s `content-configuration` to include the following:

- node properties
  - `"url": "/assets/platform-mesh-portal-ui-wc.js#generic-detail-view"`: pointing to the web component
  - `"webcomponent": {"selfRegistered": true, "type": "module"}`: indicating Luigi framework to register as a webcomponent

- context resource definition
  - because below provided example is a child of the list view node's child indicated by `"entityType": "main.account"`, the context data is
    inherited automatically via Luigi feature

#### Example Content Configuration for an Account Resource

Below is a sample content-configuration for displaying an account resource using the generic detail view:

```json
{
  "name": "overview",
  "luigiConfigFragment": {
    "data": {
      "nodes": [
        {
          "entityType": "main.account",
          "pathSegment": "dashboard",
          "label": "Dashboard",
          "url": "/assets/platform-mesh-portal-ui-wc.js#generic-detail-view",
          "webcomponent": {
            "selfRegistered": true,
            "type": "module"
          },
          "defineEntity": {
            "id": "dashboard"
          },
          "compound": {
            "children": []
          }
        }
      ]
    }
  }
}
```

In case the detail view is an independent node provide context data:

```json
{
  "context": {
    "resourceDefinition": {
      "apiGroup": "core_platform_mesh_io",
      "version": "v1alpha1",
      "entityCollection": "Accounts",
      "entity": "Account",
      "scope": "Cluster",
      "namespace": null,
      "ui": {
        "logoUrl": "https://www.kcp.io/icons/logo.svg",
        "detailView": {
          "resourceTitle": {
            "property": "spec.displayName"
          },
          "resourceDescription": {
            "property": "spec.description"
          },
          "showDownloadKubeconfig": true,
          "fields": [
            {
              "label": "Description",
              "property": "spec.description"
            },
            {
              "label": "Display Name",
              "property": "spec.displayName"
            }
          ]
        }
      }
    }
  }
}
```

## Defaults

In case neither `"detailView"`, nor `"listView` is provided, the default values will be used. In case no `"createView"` details are provided
there is no possibility of creating a resource.

## Support

For issues or questions, please refer to the [project documentation and community resources](https://openmfp.org/docs/community).
