// Preferencias por cuenta y herramientas administrativas; usa datos reales del servidor.
function clinicIncrement4() {
    return {
        v4Open: false,
        v4Tab: 'appearance',
        v4Busy: false,
        v4Message: '',
        v4Error: false,
        v4Theme: 'light',
        v4Security: { blocked: [], events: [] },
        v4Traces: null,
        v4PolicyEnabled: false,
        v4ConfirmRetention: false,
        v4UnlockUser: null,
        v4UnlockReason: '',
        get v4Title() {
            return {
                appearance: 'Apariencia y accesibilidad',
                security: 'Seguridad de acceso',
                traces: 'Mantenimiento de trazas'
            }[this.v4Tab];
        },
        async v4Request(endpoint, method = 'GET', body) {
            const response = await fetch('/api/v4/' + endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: body === undefined ? undefined : JSON.stringify(body)
            });
            const data = await response.json();
            if (!response.ok)
                throw Error(data.error || 'No se pudo completar la operación.');
            return data;
        },
        async v4Run(operation) {
            if (this.v4Busy) return;
            this.v4Busy = true;
            this.v4Message = '';
            this.v4Error = false;
            try {
                await operation();
            } catch (error) {
                this.v4Message = error.message;
                this.v4Error = true;
            } finally {
                this.v4Busy = false;
            }
        },
        async v4OpenSection(tab) {
            this.profileOpen = false;
            this.sidebarOpen = false;
            this.v4Open = true;
            this.v4Tab = tab;
            this.v4Message = '';
            this.v4Error = false;
            this.v4ConfirmRetention = false;
            if (tab === 'security')
                await this.v4Run(async () => {
                    this.v4Security = await this.v4Request('security');
                });
            if (tab === 'traces')
                await this.v4Run(async () => {
                    this.v4Traces = await this.v4Request('traces');
                    this.v4PolicyEnabled = !!this.v4Traces.policy.enabled;
                });
        },
        v4SetTheme(theme, persist = true) {
            if (!['light', 'dark'].includes(theme)) theme = 'light';
            if (
                theme === 'dark' &&
                !document.getElementById('clinic-appearance-styles')?.sheet
            ) {
                document.documentElement.dataset.theme = 'light';
                this.v4Theme = 'light';
                this.v4Message =
                    'No se pudieron cargar los estilos. Se mantiene el modo claro; recarga la página para reintentar.';
                this.v4Error = true;
                return;
            }
            this.v4Theme = theme;
            document.documentElement.dataset.theme = theme;
            if (window.Chart) {
                Chart.defaults.color = theme === 'dark' ? '#cbd5e1' : '#475569';
                Chart.defaults.borderColor =
                    theme === 'dark' ? '#334155' : '#e2e8f0';
                for (const chart of Object.values(Chart.instances || {}))
                    chart.update('none');
            }
            if (!persist || !this.usuario) return;
            this.v4Error = false;
            try {
                localStorage.setItem(
                    'clinica_theme_' + this.usuario.user_id,
                    theme
                );
                this.v4Message =
                    'Preferencia guardada para tus próximos accesos en este navegador.';
            } catch {
                this.v4Message =
                    'El modo se aplicó en esta sesión. El navegador no permitió guardar la preferencia.';
                this.v4Error = true;
            }
        },
        v4LoadTheme() {
            let theme = 'light';
            if (this.usuario) {
                try {
                    theme =
                        localStorage.getItem(
                            'clinica_theme_' + this.usuario.user_id
                        ) || 'light';
                } catch {}
            }
            this.v4SetTheme(theme, false);
        },
        async v4SavePolicy() {
            await this.v4Run(async () => {
                await this.v4Request('traces/policy', 'PUT', {
                    enabled: this.v4PolicyEnabled
                });
                this.v4Traces = await this.v4Request('traces');
                this.v4Message = this.v4PolicyEnabled
                    ? 'Retención de dos años habilitada. El mantenimiento se programa cada seis meses.'
                    : 'Política deshabilitada. Se conservarán las trazas.';
            });
        },
        async v4MaintainTraces() {
            await this.v4Run(async () => {
                const result = await this.v4Request('traces/run', 'POST', {
                    confirm: this.v4ConfirmRetention
                });
                this.v4Traces = await this.v4Request('traces');
                this.v4ConfirmRetention = false;
                this.v4Message =
                    result.outcome === 'completed'
                        ? `${result.removed} registros antiguos retirados después de verificar su respaldo.`
                        : result.outcome === 'no_records'
                          ? 'No hay registros con más de dos años. Las trazas se conservaron.'
                          : 'Primero habilita la política de retención. No se eliminó ningún registro.';
            });
        },
        async v4Unlock() {
            await this.v4Run(async () => {
                const result = await this.v4Request('security/unlock', 'POST', {
                    user_id: Number(this.v4UnlockUser),
                    reason: this.v4UnlockReason
                });
                this.v4Security = await this.v4Request('security');
                this.v4UnlockUser = null;
                this.v4UnlockReason = '';
                this.v4Message = result.message;
            });
        },
        async v4DownloadTraceBackup(id) {
            await this.v4Run(async () => {
                const response = await fetch(
                    '/api/v4/traces/' + id + '/backup'
                );
                if (!response.ok)
                    throw Error(
                        'No se pudo descargar el respaldo. Comprueba si sigue disponible.'
                    );
                const url = URL.createObjectURL(await response.blob());
                const link = document.createElement('a');
                link.href = url;
                link.download = 'respaldo-trazas-' + id + '.jsonl.gz';
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                this.v4Message = 'Respaldo descargado.';
            });
        },
        v4EventName(type) {
            return (
                {
                    LOGIN_FAILED: 'Inicio de sesión rechazado',
                    ACCESS_BLOCKED: 'Bloqueo de seguridad',
                    BLOCKED_ATTEMPT: 'Intento durante el bloqueo',
                    MANUAL_UNLOCK: 'Desbloqueo manual',
                    ALERT_SENT: 'Alerta de correo enviada',
                    ALERT_FAILED: 'Alerta de correo pendiente de revisión',
                    RETENTION_POLICY: 'Política de retención actualizada'
                }[type] || 'Evento de seguridad'
            );
        },
        v4Outcome(outcome) {
            return (
                {
                    completed: 'Completado',
                    no_records: 'Sin registros antiguos',
                    not_configured: 'Política sin habilitar',
                    failed: 'Interrumpido: datos conservados',
                    running: 'En ejecución'
                }[outcome] || 'Pendiente'
            );
        },
        v4Init() {
            this.v4LoadTheme();
            this.$watch('usuario', () => {
                this.v4Open = false;
                this.v4LoadTheme();
            });
        }
    };
}
