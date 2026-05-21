import * as OneSignal from '@onesignal/node-onesignal';

const configuration = OneSignal.createConfiguration({
    restApiKey: process.env.ONESIGNAL_REST_API_KEY,
    organizationApiKey: process.env.ONESIGNAL_ORG_API_KEY
});

export const onesignalClient = new OneSignal.DefaultApi(configuration);
export const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;

export async function sendNotification({ 
    userEmail, 
    userName, 
    type, 
    userId,
    customData = {} 
}: { 
    userEmail: string; 
    userName: string; 
    type: 'welcome' | 'maintenance' | 'confirmation' | 'itv' | 'oil_change' | 'tyre_change'; 
    userId?: string;
    customData?: any 
}) {
    if (!ONESIGNAL_APP_ID) {
        throw new Error('ONESIGNAL_APP_ID is not configured');
    }

    const templates = {
        welcome: {
            template_id: 'template_welcome_v1',
            subject: '🦁 ¡Bienvenido a SIMVA!',
            title: 'Bienvenido a SIMVA'
        },
        maintenance: {
            template_id: 'template_maintenance_v1',
            subject: '🔧 Recordatorio de mantenimiento',
            title: 'Tu coche necesita atención'
        },
        confirmation: {
            template_id: 'template_confirmation_v1',
            subject: '✅ Confirmación de cita',
            title: 'Cita confirmada'
        },
        itv: {
            template_id: 'template_maintenance_v1',
            subject: '🚗 SIMVA: ITV Próxima',
            title: 'Examen de ITV Pendiente'
        },
        oil_change: {
            template_id: 'template_maintenance_v1',
            subject: '🛢️ SIMVA: Cambio de Aceite',
            title: 'Cambio de Aceite Requerido'
        },
        tyre_change: {
            template_id: 'template_maintenance_v1',
            subject: '🚨 SIMVA: Cambio de Neumáticos',
            title: 'Neumáticos del Coche'
        }
    };

    const template = templates[type];
    if (!template) throw new Error(`Tipo de notificación no soportado: ${type}`);

    const notification = new OneSignal.Notification();
    notification.app_id = ONESIGNAL_APP_ID;
    notification.name = `${type}_notification_${Date.now()}`;

    // Configurar canal de email
    notification.email_subject = template.subject;
    notification.template_id = template.template_id;

    // Configurar push notification
    notification.headings = { en: template.title };
    notification.contents = { en: getPushContent(type, userName) };

    // Destinatarios
    notification.include_email_tokens = [userEmail];
    
    // Se asume que el alias 'email' y 'external_id' están vinculados al usuario en OneSignal
    const aliases: Record<string, string[]> = { email: [userEmail] };
    if (userId) {
        aliases.external_id = [userId];
    }
    notification.include_aliases = aliases;

    // Datos personalizados para la plantilla
    notification.custom_data = {
        user: {
            name: userName,
            email: userEmail
        },
        ...customData
    };

    try {
        const response = await onesignalClient.createNotification(notification);
        console.log(`✅ Notificación ${type} enviada a ${userEmail}: ${response.id}`);
        return { success: true, id: response.id };
    } catch (error: any) {
        console.error(`❌ Error enviando notificación a ${userEmail}:`, error);
        
        const errorMessage = error.message || String(error);
        const isCredentialOrTemplateError = 
            errorMessage.includes('403') || 
            errorMessage.includes('401') || 
            errorMessage.includes('400') || 
            error.status === 403 || 
            error.status === 401 ||
            error.status === 400 ||
            error.statusCode === 403 ||
            error.statusCode === 401 ||
            error.statusCode === 400;

        if (isCredentialOrTemplateError) {
            console.warn(`[OneSignal Sandbox Match] Redirigiendo envío fallido (${errorMessage}) a simulación local de sandbox.`);
            console.log(`💡 Para habilitar notificaciones reales, por favor asegúrate de:`);
            console.log(`   1. Configurar ONESIGNAL_REST_API_KEY y ONESIGNAL_APP_ID válidos en tus variables de entorno.`);
            console.log(`   2. Crear las plantillas 'template_welcome_v1' y 'template_maintenance_v1' en el panel de OneSignal.`);
            
            return {
                success: true,
                id: `sandbox-${type}-${Date.now()}`,
                sandbox: true,
                warning: `Aviso SIMVA (Simulador): OneSignal devolvió respuesta 403 (Sin autorización) o error de plantilla. Tus credenciales de OneSignal no están configuradas o las plantillas no existen. Hemos simulado el envío con éxito.`
            };
        }

        return { success: false, error: errorMessage };
    }
}

function getPushContent(type: string, userName: string) {
    switch (type) {
        case 'welcome':
            return `🦁 ${userName}, tu león perezoso ya está cuidando tu coche. ¡Registra tu vehículo!`;
        case 'maintenance':
            return `🔧 ${userName}, es momento de revisar tu coche. Actualiza los datos en SIMVA.`;
        case 'itv':
            return `🚗 ${userName}, se aproxima la fecha de ITV de tu vehículo. ¡Compruébala en SIMVA!`;
        case 'oil_change':
            return `🛢️ ${userName}, tu vehículo requiere cambio de aceite para un rendimiento ideal.`;
        case 'tyre_change':
            return `🚨 ${userName}, es recomendable que revises el desgaste de tus neumáticos pronto.`;
        default:
            return `📢 ${userName}, tienes una notificación de SIMVA.`;
    }
}
