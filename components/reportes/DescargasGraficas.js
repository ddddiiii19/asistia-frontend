'use client';

import { useState } from 'react';
import { descargarCsv } from '@/lib/reportes';
import {
  dependenciasACsv, descargarPng, filasDependencias, filasSerie, filasTemas, imagenDependencias, imagenSerie, imagenTemas,
  nombreArchivoGrafica, serieACsv, temasACsv, textoPeriodo,
} from '@/lib/graficas';
import { Alerta, Boton } from '@/components/ui';

// Botones para bajar una gráfica del panel como imagen PNG y sus datos como CSV (igual que la gráfica de dona).
// `etiqueta` solo la leen los lectores de pantalla: distingue los botones de cada gráfica.
function BotonesDescarga({ clave, etiqueta, vacia, crearImagen, crearCsv }) {
  const [error, setError] = useState('');
  const [generando, setGenerando] = useState(false);

  async function bajarPng() {
    setError('');
    setGenerando(true);
    try {
      await descargarPng(nombreArchivoGrafica(clave, 'png'), crearImagen());
    } catch {
      setError('No fue posible generar la imagen de la gráfica.');
    } finally {
      setGenerando(false);
    }
  }

  function bajarCsv() {
    setError('');
    descargarCsv(nombreArchivoGrafica(clave, 'csv'), crearCsv());
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        <Boton variante="secundario" onClick={bajarPng} disabled={generando || vacia}>
          {generando ? 'Generando…' : <>Descargar gráfica (PNG){' '}<span className="sr-only">{etiqueta}</span></>}
        </Boton>
        <Boton variante="secundario" onClick={bajarCsv} disabled={vacia}>
          Descargar datos (CSV){' '}<span className="sr-only">{etiqueta}</span>
        </Boton>
      </div>
      {error ? <div className="mt-3"><Alerta tipo="error">{error}</Alerta></div> : null}
    </div>
  );
}

export function DescargaDependencias({ resumen, filtros }) {
  const filas = filasDependencias(resumen);
  return (
    <BotonesDescarga
      clave="dependencias"
      etiqueta="de dependencias a las que se direccionan las consultas"
      vacia={filas.length === 0}
      crearImagen={() => imagenDependencias({ filas, subtitulo: textoPeriodo(filtros) })}
      crearCsv={() => dependenciasACsv(filas)}
    />
  );
}

export function DescargaSerie({ resumen, filtros }) {
  const filas = filasSerie(resumen);
  return (
    <BotonesDescarga
      clave="serie"
      etiqueta="de consultas por día"
      vacia={filas.length === 0}
      crearImagen={() => imagenSerie({ filas, subtitulo: textoPeriodo(filtros) })}
      crearCsv={() => serieACsv(filas)}
    />
  );
}

export function DescargaTemas({ resumen, filtros }) {
  const filas = filasTemas(resumen);
  return (
    <BotonesDescarga
      clave="temas"
      etiqueta="de temas más consultados"
      vacia={filas.length === 0}
      crearImagen={() => imagenTemas({ filas, subtitulo: textoPeriodo(filtros) })}
      crearCsv={() => temasACsv(filas)}
    />
  );
}
