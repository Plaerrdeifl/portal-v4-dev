(function () {
    'use strict';

    const widgetIds = new WeakMap();

    function statusElement(form) {
        return form.querySelector('[data-pd-m150-status]');
    }

    function setStatus(form, message, kind) {
        const status = statusElement(form);
        if (!status) {
            return;
        }
        status.textContent = message;
        status.dataset.kind = kind || '';
    }

    function turnstileForm(container) {
        const form = container.closest('[data-pd-m150-form]');
        return form instanceof HTMLFormElement ? form : null;
    }

    function setTurnstileError(container, message) {
        const form = turnstileForm(container);
        if (form) {
            setStatus(form, message, 'error');
        }
    }

    function resetTurnstile(form) {
        const container = form.querySelector('[data-pd-m150-turnstile]');
        const widgetId = container ? widgetIds.get(container) : undefined;

        if (
            typeof window.turnstile === 'undefined'
            || widgetId === undefined
        ) {
            return;
        }

        try {
            window.turnstile.reset(widgetId);
        } catch (_error) {
            // The submission result must remain visible even if
            // Turnstile itself is already in a failed browser state.
        }
    }

    function renderTurnstile(container) {
        if (
            widgetIds.has(container)
            || typeof window.turnstile === 'undefined'
            || !container.dataset.sitekey
        ) {
            return;
        }

        try {
            const widgetId = window.turnstile.render(container, {
                sitekey: container.dataset.sitekey,
                action: 'm150_membership_application',
                'response-field': true,
                'response-field-name': 'cf-turnstile-response',
                'error-callback': function () {
                    setTurnstileError(
                        container,
                        'Die Sicherheitsprüfung konnte nicht geladen werden. '
                            + 'Bitte versuche es erneut.'
                    );
                    return true;
                },
                'expired-callback': function () {
                    setTurnstileError(
                        container,
                        'Die Sicherheitsprüfung ist abgelaufen. '
                            + 'Bitte führe sie erneut durch.'
                    );
                },
                'timeout-callback': function () {
                    setTurnstileError(
                        container,
                        'Die Sicherheitsprüfung hat zu lange gedauert. '
                            + 'Bitte führe sie erneut durch.'
                    );
                },
                'unsupported-callback': function () {
                    setTurnstileError(
                        container,
                        'Die Sicherheitsprüfung wird von diesem Browser '
                            + 'nicht unterstützt. Bitte verwende einen '
                            + 'aktuellen Browser.'
                    );
                },
            });

            widgetIds.set(container, widgetId);
        } catch (_error) {
            setTurnstileError(
                container,
                'Die Sicherheitsprüfung konnte nicht geladen werden. '
                    + 'Bitte lade die Seite neu und versuche es erneut.'
            );
        }
    }

    function renderAllTurnstileWidgets() {
        document.querySelectorAll('[data-pd-m150-turnstile]').forEach(renderTurnstile);
    }

    window.pdM150TurnstileReady = renderAllTurnstileWidgets;

    const BIRTH_DATE_MIN_YEAR = 1900;
    const BIRTH_DATE_REQUIRED_MESSAGE =
        'Bitte gib dein Geburtsdatum vollständig ein.';
    const BIRTH_DATE_INVALID_MESSAGE =
        'Dieses Geburtsdatum ist ungültig.';
    const BIRTH_DATE_FUTURE_MESSAGE =
        'Das Geburtsdatum darf nicht in der Zukunft liegen.';
    const BIRTH_DATE_YEAR_MESSAGE =
        'Bitte prüfe das angegebene Geburtsjahr.';

    function berlinTodayValue() {
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Europe/Berlin',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).formatToParts(new Date());

        const values = {};
        parts.forEach(function (part) {
            if (
                part.type === 'year'
                || part.type === 'month'
                || part.type === 'day'
            ) {
                values[part.type] = part.value;
            }
        });

        return values.year + '-' + values.month + '-' + values.day;
    }

    function parseBirthDateValue(value) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return null;
        }

        const parts = value.split('-').map(Number);
        const year = parts[0];
        const month = parts[1];
        const day = parts[2];

        if (
            year < 1
            || year > 9999
            || month < 1
            || month > 12
            || day < 1
            || day > 31
        ) {
            return null;
        }

        const date = new Date(Date.UTC(year, month - 1, day));

        if (
            date.getUTCFullYear() !== year
            || date.getUTCMonth() !== month - 1
            || date.getUTCDate() !== day
        ) {
            return null;
        }

        return {
            year: year,
            month: month,
            day: day,
        };
    }

    function birthDateElements(form) {
        const day = form.querySelector('[data-pd-m150-birth-day]');
        const month = form.querySelector('[data-pd-m150-birth-month]');
        const year = form.querySelector('[data-pd-m150-birth-year]');
        const hidden = form.elements.namedItem('birthDate');
        const error = form.querySelector('[data-pd-m150-birth-error]');

        if (
            !(day instanceof HTMLSelectElement)
            || !(month instanceof HTMLSelectElement)
            || !(year instanceof HTMLInputElement)
            || !(hidden instanceof HTMLInputElement)
            || !(error instanceof HTMLElement)
        ) {
            return null;
        }

        return {
            day: day,
            month: month,
            year: year,
            hidden: hidden,
            error: error,
        };
    }

    function birthDateResult(form) {
        const elements = birthDateElements(form);
        if (!elements) {
            return null;
        }

        const day = elements.day.value.trim();
        const month = elements.month.value.trim();
        const year = elements.year.value.trim();

        if (
            !day
            || !month
            || !/^\d{4}$/.test(year)
        ) {
            let control = elements.day;
            if (day && !month) {
                control = elements.month;
            } else if (day && month) {
                control = elements.year;
            }

            return {
                valid: false,
                complete: false,
                value: '',
                message: BIRTH_DATE_REQUIRED_MESSAGE,
                control: control,
                elements: elements,
            };
        }

        const yearNumber = Number(year);

        if (yearNumber < BIRTH_DATE_MIN_YEAR) {
            return {
                valid: false,
                complete: true,
                value: '',
                message: BIRTH_DATE_YEAR_MESSAGE,
                control: elements.year,
                elements: elements,
            };
        }

        const value = year + '-' + month + '-' + day;
        const parsed = parseBirthDateValue(value);

        if (!parsed) {
            return {
                valid: false,
                complete: true,
                value: '',
                message: BIRTH_DATE_INVALID_MESSAGE,
                control: elements.day,
                elements: elements,
            };
        }

        if (value > berlinTodayValue()) {
            return {
                valid: false,
                complete: true,
                value: '',
                message: BIRTH_DATE_FUTURE_MESSAGE,
                control: elements.year,
                elements: elements,
            };
        }

        return {
            valid: true,
            complete: true,
            value: value,
            message: '',
            control: null,
            elements: elements,
        };
    }

    function setBirthDateError(elements, message) {
        elements.error.textContent = message;
        elements.error.hidden = message === '';

        [
            elements.day,
            elements.month,
            elements.year,
        ].forEach(function (control) {
            if (message) {
                control.setAttribute('aria-invalid', 'true');
            } else {
                control.removeAttribute('aria-invalid');
            }
        });
    }

    function clearBirthDateNotice(form) {
        const status = statusElement(form);

        if (
            status
            && status.dataset.kind === 'notice'
        ) {
            setStatus(form, '', '');
        }
    }

    function validateBirthDate(
        form,
        showIncomplete,
        focusInvalid
    ) {
        const result = birthDateResult(form);

        if (!result) {
            setStatus(
                form,
                'Der Mitgliedsantrag ist derzeit technisch nicht möglich.',
                'error'
            );
            return false;
        }

        result.elements.hidden.value = result.valid
            ? result.value
            : '';

        const showError = Boolean(
            result.message
            && (showIncomplete || result.complete)
        );

        setBirthDateError(
            result.elements,
            showError ? result.message : ''
        );

        if (
            showError
            && focusInvalid
            && result.control
        ) {
            result.control.focus();
        }

        return result.valid;
    }

    function isUnderEighteen(birthDateValue) {
        const birth = parseBirthDateValue(birthDateValue);
        const today = parseBirthDateValue(berlinTodayValue());

        if (!birth || !today) {
            return false;
        }

        let age = today.year - birth.year;

        if (
            today.month < birth.month
            || (
                today.month === birth.month
                && today.day < birth.day
            )
        ) {
            age -= 1;
        }

        return age < 18;
    }

    function showMinorPath(form) {
        const minorUrl = form.dataset.minorUrl || '';
        const status = statusElement(form);
        if (!status) {
            return;
        }

        status.replaceChildren();
        status.dataset.kind = 'notice';
        status.append(document.createTextNode(
            'Für Minderjährige ist ausschließlich der Papierweg vorgesehen. '
        ));
        if (minorUrl) {
            const link = document.createElement('a');
            link.href = minorUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = 'Papierantrag öffnen';
            status.append(link);
        } else {
            status.append(document.createTextNode(
                'Der Papierantrag kann aktuell nicht online bereitgestellt werden.'
            ));
        }
    }

    function turnstileToken(form) {
        const responseField = form.querySelector(
            '[name="cf-turnstile-response"]'
        );

        if (
            responseField instanceof HTMLInputElement
            || responseField instanceof HTMLTextAreaElement
        ) {
            return responseField.value.trim();
        }

        return '';
    }

    function formPayload(form) {
        const data = new FormData(form);
        const token = turnstileToken(form);

        return {
            firstName: String(data.get('firstName') || ''),
            lastName: String(data.get('lastName') || ''),
            birthDate: String(data.get('birthDate') || ''),
            email: String(data.get('email') || ''),
            phone: String(data.get('phone') || ''),
            street: String(data.get('street') || ''),
            houseNumber: String(data.get('houseNumber') || ''),
            postalCode: String(data.get('postalCode') || ''),
            city: String(data.get('city') || ''),
            applicantMessage: String(data.get('applicantMessage') || ''),
            declarationConfirmed: data.get('declarationConfirmed') === '1',
            statutesConfirmed: data.get('statutesConfirmed') === '1',
            'cf-turnstile-response': token,
        };
    }

    async function submitForm(event) {
        event.preventDefault();
        const form = event.currentTarget;

        if (!(form instanceof HTMLFormElement)) {
            return;
        }

        if (!validateBirthDate(form, true, true)) {
            return;
        }

        if (!form.reportValidity()) {
            setStatus(
                form,
                'Bitte prüfe die markierten Pflichtfelder.',
                'error'
            );
            return;
        }

        const birthDate = form.elements.namedItem('birthDate');
        if (birthDate instanceof HTMLInputElement && isUnderEighteen(birthDate.value)) {
            showMinorPath(form);
            return;
        }

        const payload = formPayload(form);
        if (!payload['cf-turnstile-response']) {
            setStatus(form, 'Bitte führe die Sicherheitsprüfung durch.', 'error');
            return;
        }

        const submitButton = form.querySelector('.pd-m150-submit');
        if (submitButton instanceof HTMLButtonElement) {
            submitButton.disabled = true;
        }
        form.setAttribute('aria-busy', 'true');
        setStatus(form, 'Der Antrag wird übermittelt …', 'pending');

        try {
            const response = await fetch(form.dataset.restUrl || '', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload),
                credentials: 'same-origin',
            });
            const result = await response.json().catch(function () {
                return null;
            });

            if (response.ok && result && result.ok === true) {
                form.reset();
                setStatus(form, 'Dein Mitgliedsantrag wurde entgegengenommen.', 'success');
                return;
            }

            if (result && result.category === 'minor') {
                showMinorPath(form);
                return;
            }

            const allowedMessages = {
                input: 'Bitte prüfe deine Eingaben.',
                security: 'Bitte führe die Sicherheitsprüfung erneut durch.',
                rate_limit: 'Zu viele Versuche. Bitte versuche es später erneut.',
                technical: 'Der Mitgliedsantrag ist derzeit technisch nicht möglich.',
            };
            const message = result && allowedMessages[result.category]
                ? allowedMessages[result.category]
                : allowedMessages.technical;
            setStatus(form, message, 'error');
        } catch (_error) {
            setStatus(
                form,
                'Der Mitgliedsantrag ist derzeit technisch nicht möglich.',
                'error'
            );
        } finally {
            resetTurnstile(form);
            form.removeAttribute('aria-busy');
            if (submitButton instanceof HTMLButtonElement) {
                submitButton.disabled = false;
            }
        }
    }

    function initializeForms() {
        document.querySelectorAll('[data-pd-m150-form]').forEach(function (form) {
            form.addEventListener('submit', submitForm);
            const birthElements = birthDateElements(form);

            if (birthElements) {
                const controls = [
                    birthElements.day,
                    birthElements.month,
                    birthElements.year,
                ];

                controls.forEach(function (control) {
                    control.addEventListener('input', function () {
                        birthElements.hidden.value = '';
                        setBirthDateError(birthElements, '');
                        clearBirthDateNotice(form);
                    });

                    control.addEventListener('change', function () {
                        clearBirthDateNotice(form);

                        const valid = validateBirthDate(
                            form,
                            false,
                            false
                        );

                        if (
                            valid
                            && isUnderEighteen(
                                birthElements.hidden.value
                            )
                        ) {
                            showMinorPath(form);
                        }
                    });
                });

                validateBirthDate(form, false, false);
            }
        });
        renderAllTurnstileWidgets();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeForms, {once: true});
    } else {
        initializeForms();
    }
}());
