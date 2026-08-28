import { parseElicitationView } from "@emseepea/server/ui";
import { useEffect, useRef, type ElementType, type FormEvent } from "react";
import type {
  ElicitationField,
  ElicitationHeadingLevel,
  ElicitationView,
} from "@emseepea/server/ui";

export interface ElicitationFormProps {
  readonly view: ElicitationView;
  readonly headingLevel: ElicitationHeadingLevel;
  readonly onSubmit?: (data: FormData) => void;
}

export function ElicitationForm({ view: candidate, headingLevel, onSubmit }: ElicitationFormProps) {
  const view = parseElicitationView(candidate);
  const Heading = heading(`h${checkedHeadingLevel(headingLevel)}`);
  const Subheading = heading(`h${Math.min(headingLevel + 1, 6)}`);
  const errorSummary = useRef<HTMLDivElement>(null);
  const status = useRef<HTMLDivElement>(null);
  const terminal = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = view.state.focusTarget === "error-summary"
      ? errorSummary.current
      : view.state.focusTarget === "status"
        ? status.current
        : view.state.focusTarget === "terminal"
          ? terminal.current
          : undefined;
    target?.focus();
  }, [candidate]);

  const submit = onSubmit
    ? (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSubmit(new FormData(event.currentTarget));
      }
    : undefined;
  const headingId = `${view.id}--heading`;
  const introId = `${view.id}--intro`;
  const statusText = view.state.kind === "ready"
    ? view.state.status ?? ""
    : view.state.kind === "invalid"
      ? `Form has ${view.state.summary.items.length} ${view.state.summary.items.length === 1 ? "error" : "errors"}.`
      : view.state.kind === "busy"
        ? view.state.status
      : sentence(view.state.heading);

  return (
    <section data-emseepea-part="view" data-emseepea-state={view.state.kind}>
      <Heading id={headingId}>{view.heading}</Heading>
      {view.intro && <p id={introId} data-emseepea-part="intro">{view.intro}</p>}
      <div
        id={`${view.id}--status`}
        data-emseepea-part="status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-relevant="additions text"
        tabIndex={view.state.focusTarget === "status" ? -1 : undefined}
        autoFocus={view.state.focusTarget === "status"}
        ref={status}
      >
        {statusText}
      </div>
      {view.state.kind === "terminal" ? (
        <div
          id={`${view.id}--terminal`}
          data-emseepea-part="terminal"
          tabIndex={-1}
          autoFocus={view.state.focusTarget === "terminal"}
          ref={terminal}
        >
          <Subheading>{view.state.heading}</Subheading>
          <p>{view.state.message}</p>
        </div>
      ) : (
        <>
          {view.state.kind === "invalid" && (
            <div
              id={`${view.id}--error-summary`}
              data-emseepea-part="error-summary"
              role="alert"
              tabIndex={-1}
              autoFocus={view.state.focusTarget === "error-summary"}
              ref={errorSummary}
            >
              <Subheading>{view.state.summary.heading}</Subheading>
              <ul>
                {view.state.summary.items.map((item) => (
                  <li key={item.fieldId}>
                    <a href={`#${view.id}--field--${item.fieldId}`}>
                      {view.fields.find((field) => field.id === item.fieldId)?.label}: {item.message}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <form
            method="post"
            data-emseepea-part="form"
            aria-labelledby={headingId}
            aria-describedby={view.intro ? introId : undefined}
            aria-busy={view.state.kind === "busy" ? "true" : undefined}
            onSubmit={submit}
          >
            <fieldset>
              <legend>{view.legend}</legend>
              {view.fields.map((field) => <Field key={field.id} viewId={view.id} field={field} />)}
            </fieldset>
            <button type="submit" data-emseepea-part="submit" disabled={view.state.kind === "busy"}>
              {view.submitLabel}
            </button>
          </form>
        </>
      )}
    </section>
  );
}

function Field({ viewId, field }: { readonly viewId: string; readonly field: ElicitationField }) {
  const fieldId = `${viewId}--field--${field.id}`;
  const descriptionId = `${fieldId}--description`;
  const errorId = `${fieldId}--error`;
  const describedBy = [field.description ? descriptionId : undefined, field.errors?.length ? errorId : undefined]
    .filter(Boolean).join(" ") || undefined;
  const common = {
    id: fieldId,
    name: field.name,
    required: field.required,
    disabled: field.disabled,
    "aria-invalid": field.errors?.length ? true : undefined,
    "aria-describedby": describedBy,
  } as const;
  const controlKey = field.kind === "checkbox"
    ? `${field.id}:${field.kind}:${field.checked}`
    : `${field.id}:${field.kind}:${field.value ?? ""}`;
  const control = field.kind === "text"
    ? <input key={controlKey} type="text" {...common} defaultValue={field.value} minLength={field.minLength} maxLength={field.maxLength} />
    : field.kind === "select"
      ? (
          <select key={controlKey} {...common} defaultValue={field.value ?? ""}>
            <option value="">{field.placeholder}</option>
            {field.options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>
            ))}
          </select>
        )
      : <input key={controlKey} type="checkbox" value="true" {...common} defaultChecked={field.checked} />;

  const label = <label htmlFor={fieldId}>{field.label}{field.required && <> <span data-emseepea-part="required">(required)</span></>}</label>;

  return (
    <div data-emseepea-part="field" data-emseepea-field-kind={field.kind}>
      {field.kind === "checkbox" ? <>{control}{label}</> : <>{label}{control}</>}
      {field.description && <p id={descriptionId} data-emseepea-part="description">{field.description}</p>}
      {field.errors?.length ? (
        <div id={errorId} data-emseepea-part="field-error">
          {field.errors.map((error) => <p key={error}>{error}</p>)}
        </div>
      ) : null}
    </div>
  );
}

function checkedHeadingLevel(value: unknown): ElicitationHeadingLevel {
  if (value !== 2 && value !== 3 && value !== 4 && value !== 5 && value !== 6) {
    throw new TypeError("headingLevel must be an integer from 2 to 6");
  }
  return value;
}

function heading(name: string): ElementType {
  return name as ElementType;
}

function sentence(value: string): string {
  return /[.!?]$/.test(value) ? value : `${value}.`;
}
