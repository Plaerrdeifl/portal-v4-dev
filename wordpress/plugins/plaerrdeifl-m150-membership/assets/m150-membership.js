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

    function isUnderEighteen(birthDateValue) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDateValue)) {
            return false;
        }

        const parts = birthDateValue.split('-').map(Number);
        const birthDate = new Date(parts[0], parts[1] - 1, parts[2]);
        if (
            birthDate.getFullYear() !== parts[0]
            || birthDate.getMonth() !== parts[1] - 1
            || birthDate.getDate() !== parts[2]
        ) {
            return false;
        }

        const today = new Date();
        const eighteenthBirthday = new Date(parts[0] + 18, parts[1] - 1, parts[2]);
        return eighteenthBirthday > new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate()
        );
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
        if (!(form instanceof HTMLFormElement) || !form.reportValidity()) {
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
                birthDate.addEventListener('change', function () {
                    if (isUnderEighteen(birthDate.value)) {
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
