import React, { useMemo, useState, useEffect } from 'react';
import { User, Appointment, Specialty, AppointmentStatus, HealthUnit } from '../types';
import { api } from '../services/api';
import { STATUS_LABELS } from '../constants';
import { Calendar, Clock, User as UserIcon, CheckCircle, Search, Info, MapPin, Map as MapIcon, Navigation } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Corrigir ícone padrão do Leaflet no React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export const PatientPortal: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [myAppointments, setMyAppointments] = useState<Appointment[]>([]);
  const [unitDoctors, setUnitDoctors] = useState<User[]>([]);
  const [unit, setUnit] = useState<HealthUnit | null>(null);
  
  // Estado do fluxo de agendamento
  const [step, setStep] = useState(1);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [selectedSpec, setSelectedSpec] = useState('');
  const [doctors, setDoctors] = useState<User[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<User | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState('');
  const [isDayFull, setIsDayFull] = useState(false);
  const [noSchedule, setNoSchedule] = useState(false);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [patientUnits, setPatientUnits] = useState<HealthUnit[]>([]);
  const [availableSpecialties, setAvailableSpecialties] = useState<Specialty[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [allUnits, setAllUnits] = useState<HealthUnit[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('health_user');
    if (stored) {
      const u = JSON.parse(stored);
      setCurrentUser(u);
      
      Promise.all([
         api.units.getAll(),
         api.specialties.getAll(),
         api.patients.getByUserId(u.id)
      ]).then(([units, specs, pat]) => {
         setAllUnits(units);
         setSpecialties(specs);
         setPatient(pat);
         
         const validUnits = units.filter(un => 
             un.isHospital || 
             un.id === u.unitId || 
             (pat?.unitIds && pat.unitIds.includes(un.id)) ||
             pat?.unitId === un.id
         );
         setPatientUnits(validUnits);
         
         loadMyAppointments(u, pat);
      });
    }
  }, []);

  const loadMyAppointments = async (user: User, pat: Patient | null = patient) => {
      const docs = await api.users.getAll();
      setUnitDoctors(docs.filter(d => d.role === 'DOCTOR'));
      
      if (pat) {
          const appts = await api.appointments.getByPatientId(pat.id);
          setMyAppointments(appts);
      }
  };

  const handleUnitSelect = async (e: React.ChangeEvent<HTMLSelectElement>, forcedUnitId?: string) => {
      const uId = forcedUnitId || e.target.value;
      setSelectedUnitId(uId);
      setSelectedSpec('');
      setSelectedDoc(null);
      setSelectedDate('');
      setSelectedTime('');
      setAvailableSlots([]);
      setIsDayFull(false);
      setNoSchedule(false);
      
      if (!uId) {
          setAvailableSpecialties([]);
          setDoctors([]);
          setUnit(null);
          return;
      }
      
      // Update unit map view
      setUnit(allUnits.find(u => u.id === uId) || null);
      
      // Fetch doctors for this unit
      const docsInUnit = await api.users.getDoctorsByUnit(uId);
      setDoctors(docsInUnit);
      
      // Get unique specialties available
      const specIds = [...new Set(docsInUnit.map(d => d.specialtyId))].filter(Boolean);
      const specsForUnit = specialties.filter(s => specIds.includes(s.id as string));
      setAvailableSpecialties(specsForUnit);
  };

  const handleSpecSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const specId = e.target.value;
      setSelectedSpec(specId);
      setSelectedDate('');
      setSelectedTime('');
      setAvailableSlots([]);
      setIsDayFull(false);
      setNoSchedule(false);
      
      if (!specId) {
          setSelectedDoc(null);
          return;
      }
      
      // Auto-select first doctor with this specialty in the selected unit
      const doc = doctors.find(d => d.specialtyId === specId);
      setSelectedDoc(doc || null);
  };


  
  const handleDateSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const date = e.target.value;
      setSelectedDate(date);
      setSelectedTime('');
      setIsDayFull(false);
      setNoSchedule(false);
      setAvailableSlots([]);

      if (selectedDoc && selectedDoc.schedule && currentUser) {
          if (selectedDoc.maxDailyPatients) {
             const allAppts = await api.appointments.getByUnit(selectedDoc.unitId);
             const dailyCount = allAppts.filter(a => 
                 a.doctorId === selectedDoc.id && 
                 a.date === date && 
                 a.status !== 'CANCELLED'
             ).length;

             if (dailyCount >= selectedDoc.maxDailyPatients) {
                 setIsDayFull(true);
                 return;
             }
          }

          const day = new Date(date + 'T00:00:00').getDay();
          const schedule = selectedDoc.schedule.find(s => s.dayOfWeek === day);

          if (!schedule) {
              setAvailableSlots([]);
              setNoSchedule(true);
              return;
          }

          const slots = [];
          let current = convertToMinutes(schedule.startTime);
          const end = convertToMinutes(schedule.endTime);

          while (current < end) {
              slots.push(convertToString(current));
              current += 30;
          }

          const existingAppts = (await api.appointments.getAll()).filter(a => a.doctorId === selectedDoc.id && a.date === date && a.status !== 'CANCELLED');
          const bookedTimes = existingAppts.map(a => a.time);

          setAvailableSlots(slots.filter(s => !bookedTimes.includes(s)));
      }
  };


  
  const confirmAppointment = async () => {
      if (!currentUser || !selectedDoc || !selectedDate || !selectedTime || !selectedUnitId) return;

      if (selectedDoc.maxDailyPatients) {
        const allAppts = await api.appointments.getByUnit(selectedUnitId);
        const dailyCount = allAppts.filter(a => 
            a.doctorId === selectedDoc.id && 
            a.date === selectedDate && 
            a.status !== 'CANCELLED'
        ).length;

        if (dailyCount >= selectedDoc.maxDailyPatients) {
            alert('Desculpe, as vagas para este médico acabaram de ser preenchidas para esta data.');
            return;
        }
      }

      const patientsList = await api.patients.getByUnit(selectedUnitId);
      let patient = patientsList.find(p => p.userId === currentUser.id || p.email === currentUser.email);
      
      if (!patient) {
          patient = await api.patients.add({
              name: currentUser.name,
              email: currentUser.email,
              phone: 'N/A',
              cpf: '000.000.000-00',
              birthDate: '2000-01-01',
              unitId: selectedUnitId,
              userId: currentUser.id
          } as any);
      }

      await api.appointments.add({
          patientId: patient.id,
          doctorId: selectedDoc.id,
          unitId: selectedUnitId,
          date: selectedDate,
          time: selectedTime,
          notes: 'Agendado pelo Portal do Paciente'
      });

      alert('Consulta agendada com sucesso!');
      setSelectedSpec('');
      setSelectedUnitId('');
      setSelectedDoc(null);
      setSelectedDate('');
      setSelectedTime('');
      setAvailableSlots([]);
      loadMyAppointments(currentUser, patient);
  };


  const convertToMinutes = (time: string) => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
  };
  const convertToString = (minutes: number) => {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const getDocName = async (id: string) => {
      const users = await api.users.getAll();
      const u = users.find(u => u.id === id);
      return u ? u.name : 'Médico';
  };

  const doctorNameById = useMemo(() => {
      return new Map(unitDoctors.map(doctor => [doctor.id, doctor.name]));
  }, [unitDoctors]);

  const unitPosition: [number, number] = useMemo(() => {
      const latitude = Number.parseFloat((unit?.latitude || '').replace(',', '.'));
      const longitude = Number.parseFloat((unit?.longitude || '').replace(',', '.'));
      return Number.isFinite(latitude) && Number.isFinite(longitude)
          ? [latitude, longitude]
          : [-7.784, -34.896];
  }, [unit]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Cabeçalho */}
      <div>
          <h2 className="text-3xl font-black text-primary mb-2">Agendamento de Consulta</h2>
          <p className="text-slate-600 text-lg">Olá, <span className="font-bold">{currentUser?.name.split(' ')[0]}</span>. {step === 1 ? 'Selecione a especialidade para qual deseja agendar sua consulta.' : 'Siga os passos abaixo para agendar.'}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Appointment Wizard (Single Form) */}
          <div className="lg:col-span-2">
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 md:p-8">
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-8">
                     <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center border border-green-100 shrink-0">
                        <Calendar className="w-8 h-8 text-green-600" />
                     </div>
                     <h3 className="text-3xl font-bold text-[#0F4C81]">Agende sua<br/>consulta</h3>
                  </div>

                  <div className="space-y-6">
                      {/* Unidade de Saúde */}
                      <div>
                          <label className="block text-sm font-bold text-[#0F4C81] mb-2">Unidade de Saúde</label>
                          <select 
                             value={selectedUnitId}
                             onChange={handleUnitSelect}
                             className="w-full p-4 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all bg-white text-slate-700 font-medium appearance-none shadow-sm"
                          >
                             <option value="">Selecione a unidade</option>
                             {patientUnits.map(u => (
                               <option key={u.id} value={u.id}>{u.name}</option>
                             ))}
                          </select>
                      </div>

                      {/* Especialidade */}
                      <div>
                          <label className="block text-sm font-bold text-[#0F4C81] mb-2">Especialidade</label>
                          <select 
                             value={selectedSpec}
                             onChange={handleSpecSelect}
                             disabled={!selectedUnitId}
                             className="w-full p-4 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all bg-white text-slate-700 font-medium appearance-none shadow-sm disabled:opacity-50 disabled:bg-slate-50"
                          >
                             <option value="">Selecione a especialidade</option>
                             {availableSpecialties.map(s => (
                               <option key={s.id} value={s.id}>{s.name}</option>
                             ))}
                          </select>
                          {selectedSpec && !selectedDoc && (
                              <p className="text-red-500 text-sm font-medium mt-2 flex items-center gap-1">
                                  <Info className="w-4 h-4" /> Não há médicos desta especialidade na unidade selecionada.
                              </p>
                          )}
                      </div>

                      {/* Data */}
                      <div>
                          <label className="block text-sm font-bold text-[#0F4C81] mb-2">Data</label>
                          <div className="relative">
                              <Calendar className="absolute left-4 top-4 w-6 h-6 text-[#0F4C81] pointer-events-none" />
                              <input 
                                  type="date"
                                  disabled={!selectedUnitId || !selectedDoc}
                                  min={new Date().toISOString().split('T')[0]}
                                  className="w-full pl-14 p-4 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all bg-white text-slate-700 font-medium shadow-sm disabled:opacity-50 disabled:bg-slate-50 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                  value={selectedDate}
                                  onChange={handleDateSelect}
                              />
                          </div>
                      </div>

                      {/* Horário */}
                      <div>
                          <label className="block text-sm font-bold text-[#0F4C81] mb-2">Horário</label>
                          <div className="relative">
                              <Clock className="absolute left-4 top-4 w-6 h-6 text-[#0F4C81] pointer-events-none" />
                              <select 
                                 value={selectedTime}
                                 onChange={(e) => setSelectedTime(e.target.value)}
                                 disabled={!selectedDate || availableSlots.length === 0 || isDayFull}
                                 className="w-full pl-14 p-4 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all bg-white text-slate-700 font-medium appearance-none shadow-sm disabled:opacity-50 disabled:bg-slate-50"
                              >
                                 <option value="">
                                     {isDayFull 
                                         ? 'Agenda lotada para este dia' 
                                         : noSchedule 
                                             ? 'Médico não atende neste dia da semana' 
                                             : (selectedDate && availableSlots.length === 0)
                                                 ? 'Nenhum horário disponível'
                                                 : 'Selecione o horário'}
                                 </option>
                                 {availableSlots.map(s => (
                                   <option key={s} value={s}>{s}</option>
                                 ))}
                              </select>
                          </div>
                      </div>

                      <button 
                          disabled={!selectedTime || isDayFull}
                          onClick={confirmAppointment}
                          className="w-full bg-[#0F4C81] hover:bg-blue-800 text-white font-bold py-4 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg mt-8 text-lg"
                      >
                          Confirmar Agendamento
                      </button>
                  </div>
              </div>
          </div>


          {/* My Appointments Side Panel */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 h-fit sticky top-6">
              <h3 className="text-xl font-bold text-slate-800 mb-6 border-b border-slate-100 pb-4">Seus Agendamentos</h3>
              
              <div className="space-y-4">
                  {myAppointments.length > 0 ? myAppointments.map(appt => (
                      <div key={appt.id} className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
                          <div className={`absolute top-0 left-0 w-1 h-full ${
                                  appt.status === AppointmentStatus.SCHEDULED ? 'bg-primary' : 
                                  appt.status === AppointmentStatus.COMPLETED ? 'bg-secondary' : 'bg-ita-red'
                          }`}></div>
                          
                          <div className="pl-3">
                              <div className="flex justify-between items-start mb-2">
                                  <span className="font-bold text-slate-800 text-lg">{doctorNameById.get(appt.doctorId) ?? 'Médico'}</span>
                                  <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${
                                      appt.status === AppointmentStatus.SCHEDULED ? 'bg-blue-50 text-primary' : 
                                      appt.status === AppointmentStatus.COMPLETED ? 'bg-green-50 text-secondary' : 'bg-red-50 text-ita-red'
                                  }`}>
                                      {STATUS_LABELS[appt.status]}
                                  </span>
                              </div>
                              <div className="flex flex-col gap-1.5 mt-3">
                                  <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                                      <Calendar className="w-4 h-4 text-primary" />
                                      {new Date(appt.date).toLocaleDateString()}
                                  </div>
                                  <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                                      <Clock className="w-4 h-4 text-secondary" />
                                      {appt.time} <span className="text-slate-400 font-normal text-xs">(Ordem de chegada)</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                                      <MapPin className="w-4 h-4 text-ita-red" />
                                      USF vinculada
                                  </div>
                              </div>
                          </div>
                      </div>
                  )) : (
                      <div className="text-center py-8">
                          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                              <Calendar className="w-8 h-8 text-slate-300" />
                          </div>
                          <p className="text-sm font-semibold text-slate-500">Nenhuma consulta agendada.</p>
                          <p className="text-xs text-slate-400 mt-1">Utilize o painel ao lado para agendar.</p>
                      </div>
                  )}
              </div>

              {unit && (
                  <div className="mt-8 pt-6 border-t border-slate-100">
                      <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                          <MapIcon className="w-5 h-5 text-primary" />
                          Sua USF: {unit.name}
                      </h4>
                      <div className="h-48 w-full rounded-xl overflow-hidden border border-slate-200 shadow-inner mb-4 relative z-0">
                          <MapContainer key={unit.id} center={unitPosition} zoom={15} style={{ height: '100%', width: '100%' }}>
                              <TileLayer
                                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                              />
                              <Marker position={unitPosition}>
                                  <Popup>
                                      <b>{unit.name}</b><br/>
                                      {unit.address}{unit.addressNumber ? `, ${unit.addressNumber}` : ''}<br/>
                                      {unit.neighborhood}, {unit.city}
                                  </Popup>
                              </Marker>
                          </MapContainer>
                      </div>
                      <a 
                          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(unit.address + (unit.addressNumber ? ', ' + unit.addressNumber : '') + ', ' + unit.neighborhood + ', ' + unit.city + ', PE')}`}
                          target="_blank" 
                          rel="noreferrer" 
                          className="w-full bg-primary/10 hover:bg-primary/20 text-primary font-bold py-3 px-4 rounded-xl transition-all flex justify-center items-center gap-2"
                      >
                          <Navigation className="w-5 h-5" /> Como Chegar
                      </a>
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};
