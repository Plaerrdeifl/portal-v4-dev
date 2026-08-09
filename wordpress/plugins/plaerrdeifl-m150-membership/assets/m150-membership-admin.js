(function () {
    'use strict';

    function updateCurrent(field, attachment) {
        const current = field.querySelector('[data-pd-m150-current]');
        if (!current) {
            return;
        }

        current.replaceChildren();
        if (!attachment) {
            current.hidden = true;
            return;
        }

        const link = document.createElement('a');
        link.href = attachment.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Aktuell konfigurierte PDF öffnen';
        current.append(link);
        current.hidden = false;
    }

    function mediaField(button) {
        return button.closest('[data-pd-m150-media-field]');
    }

    function selectPdf(event) {
        const button = event.currentTarget;
        const field = mediaField(button);
        if (!field || typeof window.wp === 'undefined' || !window.wp.media) {
            return;
        }

        const frame = window.wp.media({
            title: button.dataset.pdM150Title || 'PDF auswählen oder hochladen',
            button: {text: 'PDF verwenden'},
            library: {type: 'application/pdf'},
            multiple: false,
        });

        frame.on('select', function () {
            const attachment = frame.state().get('selection').first().toJSON();
            if (attachment.mime !== 'application/pdf') {
                window.alert('Bitte wähle ausschließlich eine PDF-Datei aus.');
                return;
            }
            const input = field.querySelector('[data-pd-m150-media-id]');
            if (input instanceof HTMLInputElement) {
                input.value = String(attachment.id);
            }
            updateCurrent(field, attachment);
        });

        frame.open();
    }

    function removePdf(event) {
        const field = mediaField(event.currentTarget);
        if (!field) {
            return;
        }
        const input = field.querySelector('[data-pd-m150-media-id]');
        if (input instanceof HTMLInputElement) {
            input.value = '0';
        }
        updateCurrent(field, null);
    }

    function initializeAdmin() {
        document.querySelectorAll('.pd-m150-media-select').forEach(function (button) {
            button.addEventListener('click', selectPdf);
        });
        document.querySelectorAll('.pd-m150-media-remove').forEach(function (button) {
            button.addEventListener('click', removePdf);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeAdmin, {once: true});
    } else {
        initializeAdmin();
    }
}());
