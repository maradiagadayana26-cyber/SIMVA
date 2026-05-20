# Guía de Integración Móvil y Permisos GPS: SIMVA 🦁

Para empaquetar, portar o compilar **SIMVA** como una aplicación móvil nativa o híbrida (por ejemplo, utilizando **Capacitor**, **React Native**, o wrappers interactivos) y mantener la sincronización con el sistema de posicionamiento global y mapas de la aplicación, utiliza las siguientes directrices y configuraciones de permisos.

---

## 1. Configuración de Permisos en Android 🤖

Agrega estas declaraciones en el archivo `AndroidManifest.xml` de tu proyecto de compilación nativa (o en el archivo de manifiesto generado por tu wrapper):

```xml
<!-- Ubicación en el archivo: Añadir antes de la etiqueta <application> -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="com.google.android.providers.gsf.permission.READ_GSERVICES" />

<application ...>
    <!-- Proveedor de la clave API de Google Maps Platform -->
    <meta-data
        android:name="com.google.android.geo.API_KEY"
        android:value="@string/GOOGLE_MAPS_API_KEY" />
</application>
```

---

## 2. Configuración de Permisos en iOS 🍏

Agrega las siguientes condiciones y descripciones de uso en tu archivo `Info.plist` para solicitar los accesos de localización correspondientes en dispositivos Apple:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>SIMVA necesita tu ubicación para mostrarte talleres y gasolineras cercanas.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>SIMVA necesita tu ubicación incluso en segundo plano para enviarte recordatorios de mantenimiento cuando estés cerca de un taller.</string>
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
</dict>
```

---

## 3. Componente de Geolocalización Móvil (React Native Framework) 📱

Si estás desarrollando el módulo de mapas independiente usando React Native, puedes guiarte por este componente altamente pulido que solicita permisos dinámicos empleando las utilidades nativas, responde ante exclusiones y maneja las coordenadas activas del usuario:

```javascript
// components/MapComponent.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  Linking,
  Share
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';
import { request, PERMISSIONS, RESULTS, openSettings } from 'react-native-permissions';
import Config from 'react-native-config';

// Verificar si la clave de API está ausente o tiene valores genéricos / placeholders
const isInvalidApiKey = (key) => {
  if (!key) return true;
  const cleanKey = key.trim().toUpperCase();
  const placeholders = [
    'TU_API_KEY',
    'YOUR_API_KEY',
    'YOUR_GOOGLE_MAPS_PLATFORM_KEY',
    'PLACEHOLDER',
    'MOCK_KEY',
    'GOOGLE_MAPS_PLATFORM_KEY'
  ];
  return (
    cleanKey === '' ||
    placeholders.some(p => cleanKey === p || cleanKey.includes('YOUR') || cleanKey.includes('PLACEHOLDER'))
  );
};

const MapComponent = () => {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState('loading'); // 'loading' | 'granted' | 'denied' | 'blocked' | 'limited'
  const mapRef = useRef(null);

  // Solicitar permisos de ubicación y calibrar estados dinámicamente
  const requestLocationPermission = async () => {
    let permission;
    if (Platform.OS === 'ios') {
      permission = PERMISSIONS.IOS.LOCATION_WHEN_IN_USE;
    } else {
      permission = PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;
    }
    try {
      const result = await request(permission);
      return result;
    } catch (err) {
      console.error("Error al solicitar permisos:", err);
      return RESULTS.DENIED;
    }
  };

  // Obtener ubicación actual por GPS con mecanismo de fallback para optimizar rendimiento y batería
  const getCurrentLocation = (highAccuracy = true) => {
    setLoading(true);
    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({ latitude, longitude });
        setLoading(false);
      },
      (error) => {
        console.error("Geolocation error:", error);
        
        // Fallback dinámico: si falla por timeout con alta precisión, intentamos precisión equilibrada (red/Wi-Fi)
        if (error.code === 3 && highAccuracy) {
          console.log("La alta precisión del GPS ha expirado. Reintentando con geolocalización asistida por red...");
          getCurrentLocation(false);
          return;
        }

        let message = 'No se pudo obtener tu ubicación activa.';
        if (error.code === 1) {
          message = 'El permiso de ubicación fue revocado. Habilítalo en los ajustes.';
          setPermissionStatus(RESULTS.DENIED);
        } else if (error.code === 2) {
          message = 'La señal de ubicación de tu dispositivo no está disponible, por favor enciende el GPS.';
        } else if (error.code === 3) {
          message = 'Se superó el tiempo de espera al buscar tu posición GPS. Inténtalo nuevamente o muévete a un lugar más despejado.';
        }
        
        Alert.alert('Error de Posicionamiento', message, [
          { text: 'Reintentar', onPress: () => getCurrentLocation(true) },
          { text: 'Abrir ajustes', onPress: () => openSettings() }
        ]);
        setLoading(false);
      },
      { 
        enableHighAccuracy: highAccuracy, 
        timeout: highAccuracy ? 15000 : 25000, // Margen de respuesta ampliado para hardware modesto
        maximumAge: 30000                      // Evita consultas redundantes en periodos cortos (30 segundos de cacheo)
      }
    );
  };

  const initPermissionsCheck = async () => {
    setLoading(true);
    const status = await requestLocationPermission();
    setPermissionStatus(status);

    if (status === RESULTS.GRANTED || status === RESULTS.LIMITED) {
      getCurrentLocation();
    } else {
      setLoading(false);
      if (status === RESULTS.BLOCKED) {
        Alert.alert(
          '📍 Permiso Denegado de Forma Permanente',
          'Has bloqueado definitivamente el acceso a tu posición actual. Para que SIMVA pueda guiarte a los talleres autorizados o gasolineras, debes brindar permisos manualmente desde los ajustes.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Abrir ajustes', onPress: () => openSettings() }
          ]
        );
      } else {
        Alert.alert(
          '📍 Permiso de Ubicación Requerido',
          'Para gozar de los mapas interactivos de SIMVA necesitas conceder permisos de ubicación a la aplicación.',
          [
            { text: 'Ahora no', style: 'cancel' },
            { text: 'Permitir', onPress: () => initPermissionsCheck() }
          ]
        );
      }
    }
  };

  // Compartir ubicación actual con otras aplicaciones
  const handleShareLocation = async () => {
    if (!location) {
      Alert.alert('Ubicación no disponible', 'No disponemos de coordenadas GPS válidas en este momento.');
      return;
    }
    try {
      const message = `🦁 ¡Hola! Te comparto mi ubicación actual desde la app de SIMVA:\nhttps://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
      await Share.share({
        message,
        title: 'Mi Ubicación de SIMVA'
      });
    } catch (error) {
      console.error('Error al compartir ubicación:', error);
      Alert.alert('Error', 'No logramos procesar la solicitud para compartir coordenadas.');
    }
  };

  useEffect(() => {
    // Al inicio del componente, si la clave no es válida, no inicializamos la secuencia de permisos
    if (isInvalidApiKey(Config.GOOGLE_MAPS_PLATFORM_KEY)) {
      setLoading(false);
      return;
    }
    initPermissionsCheck();
  }, []);

  if (isInvalidApiKey(Config.GOOGLE_MAPS_PLATFORM_KEY)) {
    return (
      <View style={styles.centered}>
        <Text style={styles.iconHeading}>⚠️</Text>
        <Text style={styles.errorTitle}>Configuración de Google Maps Requerida</Text>
        <Text style={styles.descriptionText}>
          No se ha proporcionado una clave de Google Maps Platform válida (GOOGLE_MAPS_PLATFORM_KEY) en los archivos de configuración (.env o Config).
          Esta clave es indispensable para poder inicializar la interfaz de mapas y localizar talleres, concesionarios y estaciones de servicio cercanas.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#F5B81B" />
        <Text style={styles.infoText}>Consultando satélites y calibrando GPS...</Text>
      </View>
    );
  }

  // 1. Manejo explícito de Caso: Bloqueado permanentemente (RESULTS.BLOCKED)
  if (permissionStatus === RESULTS.BLOCKED) {
    return (
      <View style={styles.centered}>
        <Text style={styles.iconHeading}>📍</Text>
        <Text style={styles.errorTitle}>Permiso denegado permanentemente</Text>
        <Text style={styles.descriptionText}>
          Has denegado el acceso de ubicación de manera definitiva en el dispositivo. 
          SIMVA requiere de este componente activo para poder desplegar el buscador de talleres recomendados en tiempo real.
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => openSettings()}>
          <Text style={styles.buttonText}>Abrir Ajustes de la App</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 2. Manejo explícito de Caso: Denegado revocable (RESULTS.DENIED)
  if (permissionStatus === RESULTS.DENIED || !location) {
    return (
      <View style={styles.centered}>
        <Text style={styles.iconHeading}>🗺️</Text>
        <Text style={styles.errorTitle}>Acceso de ubicación desactivado</Text>
        <Text style={styles.descriptionText}>
          Por favor habilita el posicionamiento global para visualizar el lienzo de mapas y ubicar los servicios más cercanos.
        </Text>
        <TouchableOpacity style={[styles.button, { marginBottom: 12 }]} onPress={initPermissionsCheck}>
          <Text style={styles.buttonText}>Intentar de nuevo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => openSettings()}>
          <Text style={styles.secondaryButtonText}>Configuración del sistema</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        showsUserLocation
        showsMyLocationButton
        onError={(e) => console.log('Map rendering error:', e.nativeEvent)}
      />
      {/* Panel inferior para compartir la ubicación actual */}
      <View style={styles.sharePanel}>
        <Text style={styles.locationCoordinates}>
          Coordenadas GPS: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
        </Text>
        <TouchableOpacity style={styles.shareButton} onPress={handleShareLocation}>
          <Text style={styles.shareButtonText}>📤 Compartir Mi Ubicación Actual</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#FAFAFA' },
  iconHeading: { fontSize: 44, marginBottom: 16 },
  errorTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 10, textAlign: 'center' },
  errorText: { fontSize: 14, color: '#FF4444', textAlign: 'center', marginHorizontal: 20 },
  infoText: { fontSize: 14, color: '#666666', marginTop: 12, fontWeight: '500' },
  descriptionText: { fontSize: 14, color: '#666666', textAlign: 'center', marginBottom: 24, lineHeight: 20, paddingHorizontal: 16 },
  button: { backgroundColor: '#F5B81B', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3 },
  buttonText: { fontWeight: 'bold', color: '#2C2C2C', fontSize: 15 },
  secondaryButton: { paddingVertical: 10, paddingHorizontal: 20 },
  secondaryButtonText: { color: '#666666', fontWeight: '600', fontSize: 14, textDecorationLine: 'underline' },
  sharePanel: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationCoordinates: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  shareButton: {
    backgroundColor: '#F5B81B',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  shareButtonText: {
    fontWeight: 'bold',
    color: '#2C2C2C',
    fontSize: 15,
  },
});

export default MapComponent;
```

---

## 4. Estado de Enlaces y Permisos Web Activos 🖥️

Para asegurar que todo funcione de maravilla en las pruebas del navegador:

1. **Permiso de Frame en AI Studio**: La clave de mapas y consentimiento de GPS para el previsualizador iframe está configurado en el archivo `metadata.json` con `"requestFramePermissions": ["camera", "geolocation"]`.
2. **Ubicación en Navegador**: Cuando accedas a la pestaña de "Talleres" de SIMVA, el navegador te solicitará acceso de ubicación nativo de forma automática.
3. **Clave de Mapas**: La clave de desarrollo debe configurarse en la clave `GOOGLE_MAPS_PLATFORM_KEY` dentro del entorno o archivo `.env`.

---

## 5. Gestión y Almacenamiento de Manuales del Vehículo 📚

Para guardar, consultar y eliminar manuales técnicos del fabricante en formato **PDF**, **JPG** o **PNG** (con límite ampliado a **50 MB** por archivo), utiliza el siguiente diseño de base de datos relacional y componentes de integración móvil.

### A. Estructura de Base de Datos (SQL Schema) 🗄️
Si estás portando los servicios de SIMVA a una base de datos PostgreSQL, MySQL o SQLite dedicada (adicional a Firestore), esta es la definición lógica de la tabla:

```sql
-- Tabla para almacenar los manuales subidos por los usuarios
CREATE TABLE vehicle_manuals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    file_type VARCHAR(50), -- pdf, jpg, png
    file_size INT,         -- tamaño en bytes
    uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Índices para optimizar las búsquedas
CREATE INDEX idx_vehicle_manuals_vehicle_id ON vehicle_manuals(vehicle_id);
CREATE INDEX idx_vehicle_manuals_user_id ON vehicle_manuals(user_id);
```

### B. Endpoints del Servidor (Node.js + Express) 🚀
Este enrutador de Express administra la carga de archivos binarios utilizando `multer` con memoria o disco, y actualiza la base de datos de persistencia:

```javascript
// routes/manuals.js (para Node.js + Express)
const express = require('express');
const multer = require('multer');
const { bucket } = require('../config/firebase'); // Ajusta la ruta a tu entorno Firebase Admin
const router = express.Router();

// Configuración de Multer para manejar archivos en memoria con límite de 50 MB
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // Límite: 50 MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
        if (allowedTypes.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Formato no soportado. Sube un PDF, JPG o PNG.'), false);
    }
});

// Endpoint para subir un manual
router.post('/upload-manual', upload.single('manual'), async (req, res) => {
    try {
        const { vehicle_id, title, description } = req.body;
        const user_id = req.user.id; // Asumiendo autenticación middleware activa
        const file = req.file;

        if (!file) return res.status(400).json({ error: 'No se ha subido ningún archivo.' });
        if (!vehicle_id) return res.status(400).json({ error: 'El ID del vehículo es obligatorio.' });

        // Verificar que el vehículo pertenece al usuario
        const vehicle = await db('vehicles').where({ id: vehicle_id, user_id }).first();
        if (!vehicle) return res.status(404).json({ error: 'Vehículo no encontrado.' });

        // Subir el archivo a Firebase Storage
        const fileName = `manuals/${user_id}/${vehicle_id}/${Date.now()}_${file.originalname}`;
        const blob = bucket.file(fileName);
        const blobStream = blob.createWriteStream({ metadata: { contentType: file.mimetype } });

        blobStream.on('error', (error) => {
            console.error(error);
            res.status(500).json({ error: 'Error al subir el archivo.' });
        });

        blobStream.on('finish', async () => {
            await blob.makePublic(); // Generar URL pública directa
            const fileUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

            // Guardar la referencia en la base de datos
            const [manualId] = await db('vehicle_manuals').insert({
                vehicle_id,
                user_id,
                title: title || file.originalname,
                description: description || null,
                file_url: fileUrl,
                file_type: file.mimetype,
                file_size: file.size,
                uploaded_at: new Date()
            }).returning('id');

            res.status(201).json({
                message: 'Manual subido correctamente',
                manual: { id: manualId, title: title || file.originalname, file_url: fileUrl }
            });
        });

        blobStream.end(file.buffer);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// Endpoint para obtener todos los manuales de un vehículo
router.get('/vehicle/:vehicle_id/manuals', async (req, res) => {
    try {
        const { vehicle_id } = req.params;
        const user_id = req.user.id;

        const vehicle = await db('vehicles').where({ id: vehicle_id, user_id }).first();
        if (!vehicle) return res.status(404).json({ error: 'Vehículo no encontrado.' });

        const manuals = await db('vehicle_manuals')
            .where({ vehicle_id, user_id })
            .orderBy('uploaded_at', 'desc')
            .select('id', 'title', 'description', 'file_url', 'file_type', 'file_size', 'uploaded_at');

        res.json(manuals);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener los manuales.' });
    }
});

// Endpoint para eliminar un manual
router.delete('/manual/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const user_id = req.user.id;

        const manual = await db('vehicle_manuals').where({ id, user_id }).first();
        if (!manual) return res.status(404).json({ error: 'Manual no encontrado.' });

        // Eliminar archivo de Firebase Storage
        const fileName = manual.file_url.split('/').pop();
        await bucket.file(`manuals/${user_id}/${manual.vehicle_id}/${fileName}`).delete();

        // Eliminar registro de la base de datos
        await db('vehicle_manuals').where({ id }).del();

        res.json({ message: 'Manual eliminado correctamente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar el manual.' });
    }
});

module.exports = router;
```

### C. Componente de Interfaz de Usuario (React Native) 📱
Este componente nativo se integra con `react-native-document-picker` para examinar el almacenamiento local y subir los manuales con retroalimentación animada a los endpoints del servidor:

```javascript
// components/VehicleManuals.js (React Native)
import React, { useState, useEffect } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
    Alert, Linking, Image
} from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import Icon from 'react-native-vector-icons/MaterialIcons';

const VehicleManuals = ({ vehicleId }) => {
    const [manuals, setManuals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        fetchManuals();
    }, [vehicleId]);

    const fetchManuals = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/vehicle/${vehicleId}/manuals`, {
                headers: { Authorization: `Bearer ${await getToken()}` }
            });
            const data = await response.json();
            setManuals(data);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'No se pudieron cargar los manuales.');
        } finally {
            setLoading(false);
        }
    };

    const pickDocument = async () => {
        try {
            const result = await DocumentPicker.pick({
                type: [DocumentPicker.types.pdf, DocumentPicker.types.images]
            });
            await uploadManual(result);
        } catch (err) {
            if (!DocumentPicker.isCancel(err)) Alert.alert('Error', err.message);
        }
    };

    const uploadManual = async (doc) => {
        setUploading(true);
        const formData = new FormData();
        formData.append('vehicle_id', vehicleId);
        formData.append('title', doc.name);
        formData.append('manual', {
            uri: doc.uri,
            type: doc.type,
            name: doc.name
        });

        try {
            const response = await fetch('/api/upload-manual', {
                method: 'POST',
                headers: { Authorization: `Bearer ${await getToken()}` },
                body: formData
            });
            if (response.ok) {
                Alert.alert('Éxito', 'Manual subido correctamente.');
                fetchManuals();
            } else {
                const error = await response.json();
                Alert.alert('Error', error.error || 'Error al subir el manual.');
            }
        } catch (error) {
            Alert.alert('Error', 'No se pudo conectar con el servidor.');
        } finally {
            setUploading(false);
        }
    };

    const deleteManual = (id) => {
        Alert.alert(
            'Eliminar manual',
            '¿Estás seguro de que quieres eliminar este manual?',
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Eliminar', style: 'destructive', onPress: () => confirmDelete(id) }
            ]
        );
    };

    const confirmDelete = async (id) => {
        try {
            const response = await fetch(`/api/manual/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${await getToken()}` }
            });
            if (response.ok) {
                Alert.alert('Eliminado', 'Manual eliminado correctamente.');
                fetchManuals();
            } else {
                Alert.alert('Error', 'No se pudo eliminar el manual.');
            }
        } catch (error) {
            Alert.alert('Error', 'Error al conectar con el servidor.');
        }
    };

    const openManual = (url) => {
        Linking.openURL(url).catch(() => Alert.alert('Error', 'No se puede abrir el archivo.'));
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity style={styles.card} onPress={() => openManual(item.file_url)}>
            <View style={styles.cardContent}>
                {item.file_type.startsWith('image/') ? (
                    <Image source={{ uri: item.file_url }} style={styles.thumbnail} />
                ) : (
                    <View style={styles.pdfIcon}>
                        <Text style={styles.pdfIconText}>📄</Text>
                    </View>
                )}
                <View style={styles.cardDetails}>
                    <Text style={styles.title}>{item.title}</Text>
                    <Text style={styles.date}>{new Date(item.uploaded_at).toLocaleDateString()}</Text>
                </View>
                <TouchableOpacity onPress={() => deleteManual(item.id)} style={styles.deleteButton}>
                    <Icon name="delete" size={24} color="#FF4444" />
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );

    if (loading) return <ActivityIndicator size="large" color="#F5B81B" />;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.sectionTitle}>📚 Manuales de SIMVA</Text>
                <TouchableOpacity style={styles.addButton} onPress={pickDocument} disabled={uploading}>
                    <Icon name="add" size={24} color="#FFF" />
                    <Text style={styles.addButtonText}>Subir manual</Text>
                </TouchableOpacity>
            </View>
            {uploading && <ActivityIndicator size="small" color="#F5B81B" />}
            {manuals.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Icon name="description" size={60} color="#CCC" />
                    <Text style={styles.emptyText}>No hay manuales subidos</Text>
                    <Text style={styles.emptySubtext}>Toca el botón Subir manual para guardar las guías de tu coche</Text>
                </View>
            ) : (
                <FlatList
                    data={manuals}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id.toString()}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { padding: 16, backgroundColor: 'transparent' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#2C2C2C' },
    addButton: { flexDirection: 'row', backgroundColor: '#F5B81B', padding: 8, borderRadius: 8, alignItems: 'center' },
    addButtonText: { color: '#2C2C2C', fontWeight: 'bold', marginLeft: 4 },
    card: { backgroundColor: '#FFF', borderRadius: 12, marginBottom: 12, padding: 12, shadowOpacity: 0.1, shadowRadius: 4 },
    cardContent: { flexDirection: 'row', alignItems: 'center' },
    thumbnail: { width: 60, height: 60, borderRadius: 8, marginRight: 12 },
    pdfIcon: { width: 60, height: 60, backgroundColor: '#FFE0B2', borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    pdfIconText: { fontSize: 32 },
    cardDetails: { flex: 1 },
    title: { fontSize: 16, fontWeight: '500', color: '#2C2C2C' },
    date: { fontSize: 12, color: '#999', marginTop: 4 },
    deleteButton: { padding: 8 },
    emptyContainer: { alignItems: 'center', marginVertical: 40 },
    emptyText: { fontSize: 16, color: '#666', marginTop: 12 },
    emptySubtext: { fontSize: 12, color: '#999', marginTop: 4, textAlign: 'center' },
});

export default VehicleManuals;
```

### D. Integración en Pantallas Móviles (Screens Workflow) 📱
Agrega la sección directamente en tu panel de detalles para que se inicialice automáticamente basada en el ID seleccionado del vehículo:

```javascript
// screens/VehicleDetailScreen.js (fragmento)
import VehicleManuals from '../components/VehicleManuals';

const VehicleDetailScreen = ({ route }) => {
    const { vehicleId } = route.params;

    return (
        <ScrollView style={styles.container}>
            {/* ... Renderizar otros componentes de la ficha técnica ... */}
            <VehicleManuals vehicleId={vehicleId} />
            {/* ... Resto de enlaces o logs de mantenimiento ... */}
        </ScrollView>
    );
};
```

