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

    const BIRTH_DATE_MIN = '1900-01-01';
    const BIRTH_DATE_REQUIRED_MESSAGE =
        'Bitte gib dein Geburtsdatum vollständig ein.';
    const BIRTH_DATE_INVALID_MESSAGE =
        'Bitte gib ein gültiges Geburtsdatum ein.';

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
            year < 1900
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

    function birthDateValidationMessage(value) {
        if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return BIRTH_DATE_REQUIRED_MESSAGE;
        }

        const parsed = parseBirthDateValue(value);
        if (!parsed) {
            return BIRTH_DATE_INVALID_MESSAGE;
        }

        if (
            value < BIRTH_DATE_MIN
            || value > berlinTodayValue()
        ) {
            return BIRTH_DATE_INVALID_MESSAGE;
        }

        return '';
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

    function clearBirthDateStatus(form) {
        const status = statusElement(form);
        if (!status) {
            return;
        }

        if (
            status.dataset.kind === 'notice'
            || status.textContent === BIRTH_DATE_REQUIRED_MESSAGE
            || status.textContent === BIRTH_DATE_INVALID_MESSAGE
        ) {
            setStatus(form, '', '');
        }
    }

    function validateBirthDate(form) {
        const birthDate = form.elements.namedItem('birthDate');

        if (!(birthDate instanceof HTMLInputElement)) {
            setStatus(
                form,
                'Der Mitgliedsantrag ist derzeit technisch nicht möglich.',
                'error'
            );
            return false;
        }

        const message = birthDateValidationMessage(birthDate.value);
        birthDate.setCustomValidity(message);

        if (message) {
            setStatus(form, message, 'error');
            birthDate.reportValidity();
            return false;
        }

        birthDate.setCustomValidity('');
        return true;
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

        if (!validateBirthDate(form)) {
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
            const birthDate = form.elements.namedItem('birthDate');
            if (birthDate instanceof HTMLInputElement) {
                birthDate.min = BIRTH_DATE_MIN;
                birthDate.max = berlinTodayValue();

                birthDate.addEventListener('input', function () {
                    birthDate.setCustomValidity('');
                    clearBirthDateStatus(form);
                });

                birthDate.addEventListener('change', function () {
                    birthDate.setCustomValidity('');
                    clearBirthDateStatus(form);

                    if (
                        birthDateValidationMessage(birthDate.value) === ''
                        && isUnderEighteen(birthDate.value)
                    ) {
                        showMinorPath(form);
                    }
                });
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
