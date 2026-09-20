/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { NotificationsModel } from '../../../common/notifications.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { INotificationService, INotification, INotificationHandle, Severity, NotificationMessage, IPromptChoice, IPromptOptions, NoOpNotification, NotificationsFilter, INotificationSourceFilter, IStatusHandle } from '../../../../platform/notification/common/notification.js';

/** Close asynchronously so extension API requests never wait on an invisible popup. */
class DismissedNotification extends NoOpNotification {
	private readonly closed = new Emitter<void>();
	override readonly onDidClose = this.closed.event;
	private isClosed = false;
	constructor(private readonly onCancel?: () => void) {
		super();
		queueMicrotask(() => this.close());
	}
	override close(): void {
		if (this.isClosed) { return; }
		this.isClosed = true;
		try { this.onCancel?.(); } finally {
			this.closed.fire();
			this.closed.dispose();
		}
	}
}

/** Compatibility for language/editor APIs. Sofik has no notification center or toasts. */
export class NotificationService extends Disposable implements INotificationService {
	declare readonly _serviceBrand: undefined;
	readonly onDidChangeFilter = Event.None;
	// Kept for the unshipped upstream sessions entrypoint; never receives items.
	readonly model = this._register(new NotificationsModel());
	constructor(@ILogService private readonly logService: ILogService) { super(); }

	setFilter(): void { }
	getFilter(): NotificationsFilter { return NotificationsFilter.ERROR; }
	getFilters(): INotificationSourceFilter[] { return []; }
	removeFilter(): void { }

	notify(notification: INotification): INotificationHandle {
		this.log(notification.severity, notification.message);
		return new DismissedNotification();
	}
	info(message: NotificationMessage | NotificationMessage[]): void { this.log(Severity.Info, message); }
	warn(message: NotificationMessage | NotificationMessage[]): void { this.log(Severity.Warning, message); }
	error(message: NotificationMessage | NotificationMessage[]): void { this.log(Severity.Error, message); }

	prompt(severity: Severity, message: string, _choices: IPromptChoice[], options?: IPromptOptions): INotificationHandle {
		this.log(severity, message);
		return new DismissedNotification(options?.onCancel);
	}
	status(message: NotificationMessage): IStatusHandle {
		this.log(Severity.Info, message);
		return { close() { } };
	}

	private log(severity: Severity, messages: NotificationMessage | NotificationMessage[]): void {
		for (const message of Array.isArray(messages) ? messages : [messages]) {
			if (severity === Severity.Error) { this.logService.error(message); }
			else if (severity === Severity.Warning) { this.logService.warn(String(message)); }
			else { this.logService.info(String(message)); }
		}
	}
}

registerSingleton(INotificationService, NotificationService, InstantiationType.Delayed);
